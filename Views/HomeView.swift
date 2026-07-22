import SwiftUI

/// 6.1 ??????????????????????????????????????????????????????????????????????????????????????????????????????
public struct HomeView: View {
    @ObservedObject var dataManager = DataManager.shared
    @ObservedObject var ttsManager = TTSManager.shared

    @State private var showingNewScriptAlert = false
    @State private var newScriptTitle = ""
    @State private var selectedScriptForStage: Script?
    @State private var isStageModeActive = false

    public var body: some View {
        NavigationStack {
            ZStack {
                Color(uiColor: .systemGroupedBackground)
                    .ignoresSafeArea()

                VStack(spacing: 20) {
                    // ??????獢???????????????????????banner
                    if let firstScript = dataManager.scripts.first {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "mic.fill")
                                    .font(.title2)
                                    .foregroundColor(.yellow)
                                 Text("Recent script")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                Spacer()
                            }

                            Text("????????????(firstScript.title)")
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.8))

                            Button(action: {
                                selectedScriptForStage = firstScript
                                ttsManager.loadScript(firstScript)
                                isStageModeActive = true
                            }) {
                                HStack {
                                    Image(systemName: "play.circle.fill")
                                        .font(.title3)
                                    Text("????????????????????????????")
                                        .font(.system(size: 18, weight: .bold))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(Color.yellow)
                                .foregroundColor(.black)
                                .cornerRadius(12)
                            }
                            .accessibilityLabel("????????????????????????????")
                             .accessibilityHint("Open the first script in stage mode")
                        }
                        .padding(16)
                        .background(
                            LinearGradient(gradient: Gradient(colors: [Color.purple, Color.indigo]), startPoint: .topLeading, endPoint: .bottomTrailing)
                        )
                        .cornerRadius(18)
                        .shadow(color: Color.purple.opacity(0.3), radius: 10, x: 0, y: 5)
                        .padding(.horizontal)
                    }

                    // ?????????????????header
                    HStack {
                         Text("My scripts")
                            .font(.title2)
                            .fontWeight(.bold)
                        Spacer()
                        Button(action: {
                            newScriptTitle = "???????????????????????\(dataManager.scripts.count + 1)"
                            showingNewScriptAlert = true
                        }) {
                            HStack(spacing: 6) {
                                Image(systemName: "plus.circle.fill")
                                 Text("New script")
                            }
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.blue)
                        }
                         .accessibilityLabel("New script")
                    }
                    .padding(.horizontal)

                    // ?????????????????
                    if dataManager.scripts.isEmpty {
                        VStack(spacing: 12) {
                            Image(systemName: "doc.text.magnifyingglass")
                                .font(.system(size: 50))
                                .foregroundColor(.secondary)
                         Text("No scripts yet")
                                .foregroundColor(.secondary)
                        }
                        .frame(maxHeight: .infinity)
                    } else {
                        List {
                            ForEach(dataManager.scripts) { script in
                                NavigationLink(destination: ScriptEditorView(script: script)) {
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(script.title)
                                            .font(.headline)
                                        HStack {
                                             Text("\(script.lines.count) lines")
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                            Spacer()
                                            Text(script.updatedAt, style: .date)
                                                .font(.caption2)
                                                .foregroundColor(.secondary)
                                        }
                                    }
                                    .padding(.vertical, 4)
                                }
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        dataManager.deleteScript(id: script.id)
                                    } label: {
                                        Label("????", systemImage: "trash")
                                    }
                                }
                            }
                        }
                        .listStyle(.insetGrouped)
                    }
                }
                .padding(.top)
            }
            .navigationTitle("Mic Cue ?????????????")
             .alert("Create script", isPresented: $showingNewScriptAlert) {
                TextField("?????????????", text: $newScriptTitle)
                Button("???", role: .cancel) { }
                Button("????") {
                    let created = dataManager.createScript(title: newScriptTitle)
                    newScriptTitle = ""
                }
            }
            .fullScreenCover(isPresented: $isStageModeActive) {
                if let script = selectedScriptForStage {
                    StageModeView(script: script, isPresented: $isStageModeActive)
                }
            }
        }
    }
}