import SwiftUI
import UIKit
import AVFoundation
import UniformTypeIdentifiers

/// 6.4 ????????????????????????????????????????澗窄?????????????????????????????????????????????????????????Ⅹ?????JSON
public struct SettingsView: View {
    @ObservedObject var ttsManager = TTSManager.shared
    @ObservedObject var dataManager = DataManager.shared

    @State private var showingExportShareSheet = false
    @State private var exportURL: URL?
    @State private var isImporting = false
    @State private var importAlertMessage: String?
    @State private var showImportAlert = false

    public var body: some View {
        NavigationStack {
            Form {
                // MARK: ?????????????????????
                Section(header: Text("TTS ???????????????????????????")) {
                    Picker("Voice", selection: Binding(get: { ttsManager.selectedVoiceIdentifier }, set: { value in
                        ttsManager.selectedVoiceIdentifier = value
                        saveTTSSettings()
                    })) {
                        Text("System voice").tag("")
                        ForEach(ttsManager.availableVoices(), id: \.identifier) { voice in
                            Text("\(voice.name) (\(voice.language))")
                                .tag(voice.identifier)
                        }
                    }
                    .pickerStyle(.menu)

                    VStack(alignment: .leading) {
                        HStack {
                            Text("????????(Speech Rate)")
                            Spacer()
                            Text(String(format: "%.1fx", ttsManager.rateMultiplier))
                                .foregroundColor(.secondary)
                        }
                        Slider(value: Binding(get: { ttsManager.rateMultiplier }, set: { value in
                        ttsManager.rateMultiplier = value
                        saveTTSSettings()
                    }), in: 0.5...2.0, step: 0.1)
                    }

                    VStack(alignment: .leading) {
                        HStack {
                            Text("????? (Pitch)")
                            Spacer()
                            Text(String(format: "%.2f", ttsManager.pitch))
                                .foregroundColor(.secondary)
                        }
                        Slider(value: Binding(get: { ttsManager.pitch }, set: { value in
                        ttsManager.pitch = value
                        saveTTSSettings()
                    }), in: 0.5...1.8, step: 0.05)
                    }

                    Button(action: {
                        ttsManager.preview(text: "This is a voice preview for Mic Cue.")
                    }) {
                        HStack {
                            Image(systemName: "play.circle.fill")
                            Text("???????????????????????????????")
                        }
                        .foregroundColor(.blue)
                    }
                    .accessibilityLabel("???????????????????????????????")
                }

                Section(header: Text("Stage mode")) {
                    VStack(alignment: .leading) {
                        HStack {
                            Text("???????????")
                            Spacer()
                            Text(String(format: "%.1fx", dataManager.settings.fontSizeScale))
                                .foregroundColor(.secondary)
                        }
                        Slider(value: $dataManager.settings.fontSizeScale, in: 1.0...2.2, step: 0.1) { _ in
                            dataManager.saveData()
                        }
                    }

                    Toggle("???????????????????????????", isOn: Binding(
                        get: { dataManager.settings.isStageModeLockEnabled },
                        set: { val in
                            dataManager.settings.isStageModeLockEnabled = val
                            dataManager.saveData()
                        }
                    ))
                }

                // MARK: ????????????秋ㄠ???????                Section(header: Text("?????????(Accessibility)")) {
                    Toggle("??? VoiceOver ????????????", isOn: Binding(
                        get: { dataManager.settings.isVoiceOverFriendly },
                        set: { val in
                            dataManager.settings.isVoiceOverFriendly = val
                            dataManager.saveData()
                        }
                    ))
                }

                // MARK: ??????????????????Ⅹ??????????????                Section(header: Text("????????????????(JSON ???)")) {
                    Button(action: exportBackup) {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                            Text("??????Ⅹ?????????????????????(JSON ????)")
                        }
                    }

                    Button(action: {
                        isImporting = true
                    }) {
                        HStack {
                            Image(systemName: "square.and.arrow.down")
                            Text("??????Ⅹ?????JSON ???????????")
                        }
                        .foregroundColor(.green)
                    }
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showingExportShareSheet) {
                if let url = exportURL {
                    ShareSheet(activityItems: [url])
                }
            }
            .fileImporter(
                isPresented: $isImporting,
                allowedContentTypes: [.json],
                allowsMultipleSelection: false
            ) { result in
                switch result {
                case .success(let urls):
                    guard let selectedURL = urls.first else { return }
                    let hasAccess = selectedURL.startAccessingSecurityScopedResource()
                    defer {
                        if hasAccess { selectedURL.stopAccessingSecurityScopedResource() }
                    }
                    do {
                        let data = try Data(contentsOf: selectedURL)
                        let success = dataManager.importBackupJSON(from: data)
                        importAlertMessage = success ? "Import succeeded" : "Import failed"
                    } catch {
                        importAlertMessage = "Unable to read file: \(error.localizedDescription)"
                    }
                    showImportAlert = true
                case .failure(let error):
                    importAlertMessage = "???????????: \(error.localizedDescription)"
                    showImportAlert = true
                }
            }
            .alert("??????Ⅹ????????", isPresented: $showImportAlert) {
                Button("????", role: .cancel) { }
            } message: {
                Text(importAlertMessage ?? "")
            }
        }
    }

    private func saveTTSSettings() {
        dataManager.settings.defaultVoiceIdentifier = ttsManager.selectedVoiceIdentifier
        dataManager.settings.defaultRate = ttsManager.rateMultiplier
        dataManager.settings.defaultPitch = ttsManager.pitch
        dataManager.saveData()
    }

    private func exportBackup() {
        guard let jsonData = dataManager.exportBackupJSON() else { return }
        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent("MicCue_Backup.json")
        do {
            try jsonData.write(to: tempURL)
            self.exportURL = tempURL
            self.showingExportShareSheet = true
        } catch {
            print("????????????????Ⅹ?????? \(error)")
        }
    }
}

/// iOS ??????? UIActivityViewController ??? View
struct ShareSheet: UIViewControllerRepresentable {
    var activityItems: [Any]
    var applicationActivities: [UIActivity]? = nil

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: activityItems, applicationActivities: applicationActivities)
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}