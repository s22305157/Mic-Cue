import SwiftUI

/// 6.2 ??殉秧?箏??蹐???殉秧????蹓魂?殉???萄?蹓澗??筑??箏?拙??梧??甇?????鈭??蹓橘????殉朽?蹓曉疵??
public struct ScriptEditorView: View {
    @ObservedObject var dataManager = DataManager.shared
    @ObservedObject var ttsManager = TTSManager.shared

    @State var script: Script
    @State private var scriptTitle: String = ""
    @State private var newSentenceText: String = ""
    @State private var isStageModeActive: Bool = false

    public init(script: Script) {
        _script = State(initialValue: script)
        _scriptTitle = State(initialValue: script.title)
    }

    public var body: some View {
        VStack(spacing: 0) {
            // ????岳???
            HStack {
                Image(systemName: "pencil")
                    .foregroundColor(.blue)
                TextField("??殉秧???", text: $scriptTitle, onCommit: {
                    saveTitleChange()
                })
                .font(.title3)
                .fontWeight(.bold)
                .textFieldStyle(.roundedBorder)

                Button("??????") {
                    saveTitleChange()
                }
                .buttonStyle(.borderedProminent)
                .font(.caption)
            }
            .padding()
            .background(Color(uiColor: .secondarySystemGroupedBackground))

            // ?寞伐????鈭??岳?舐?            HStack {
                TextField("?岳??????望???..", text: $newSentenceText)
                    .textFieldStyle(.roundedBorder)

                Button(action: {
                    addNewLine()
                }) {
                    HStack {
                        Image(systemName: "plus")
                        Text("???")
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(newSentenceText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color(uiColor: .systemGroupedBackground))

            // ?鈭??謅?
            List {
                ForEach(currentSortedLines) { line in
                    LineRowView(line: line, onUpdate: { updatedLine in
                        dataManager.updateLine(updatedLine)
                        reloadLocalScript()
                    }, onPreview: { lineToPreview in
                        ttsManager.speakLine(lineToPreview)
                    })
                }
                .onDelete(perform: deleteLine)
                .onMove(perform: moveLine)
            }
            .listStyle(.plain)

            // ?制??豯止????
            Button(action: {
                ttsManager.loadScript(script)
                isStageModeActive = true
            }) {
                HStack {
                    Image(systemName: "sparkles.tv.fill")
                        .font(.title2)
                    Text("?漲????蟡???豯止??")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.indigo)
                .foregroundColor(.white)
            }
        }
        .navigationTitle("?箏???殉秧")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            EditButton()
        }
        .onAppear {
            reloadLocalScript()
        }
        .fullScreenCover(isPresented: $isStageModeActive) {
            StageModeView(script: script, isPresented: $isStageModeActive)
        }
    }

    private var currentSortedLines: [ScriptLine] {
        script.sortedLines
    }

    private func saveTitleChange() {
        script.title = scriptTitle
        dataManager.updateScript(script)
    }

    private func addNewLine() {
        guard !newSentenceText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        _ = dataManager.addLine(to: script.id, text: newSentenceText)
        newSentenceText = ""
        reloadLocalScript()
    }

    private func deleteLine(at offsets: IndexSet) {
        dataManager.deleteLine(from: script.id, atOffsets: offsets)
        reloadLocalScript()
    }

    private func moveLine(from source: IndexSet, to destination: Int) {
        dataManager.moveLines(in: script.id, from: source, to: destination)
        reloadLocalScript()
    }

    private func reloadLocalScript() {
        if let updated = dataManager.scripts.first(where: { $0.id == script.id }) {
            self.script = updated
            self.scriptTitle = updated.title
        }
    }
}

/// ?鈭??箏??獢? Views
struct LineRowView: View {
    @State var line: ScriptLine
    var onUpdate: (ScriptLine) -> Void
    var onPreview: (ScriptLine) -> Void

    @State private var isExpanded: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 10) {
                Text("\(line.orderIndex + 1).")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.secondary)
                    .frame(width: 24)

                TextEditor(text: Binding(
                    get: { line.text },
                    set: { newText in
                        line.text = newText
                        onUpdate(line)
                    }
                ))
                .frame(minHeight: 40)
                .border(Color.gray.opacity(0.2), width: 1)
                .cornerRadius(6)

                // ?啗正蹓???
                Button(action: {
                    onPreview(line)
                }) {
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.title3)
                        .foregroundColor(.blue)
                        .padding(6)
                }
                .buttonStyle(.borderless)
                 .accessibilityLabel("Preview line \(line.orderIndex + 1)")

                // ??????謚??桀??
                Button(action: {
                    withAnimation {
                        isExpanded.toggle()
                    }
                }) {
                    Image(systemName: isExpanded ? "chevron.up" : "ellipsis")
                        .foregroundColor(.secondary)
                        .padding(6)
                }
                .buttonStyle(.borderless)
            }

            // ????桀?????望????????
            if isExpanded {
                HStack {
                    Text("?鈭??謚?: \(line.pauseAfterMs) ms")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Stepper("", value: Binding(
                        get: { line.pauseAfterMs },
                        set: { val in
                            line.pauseAfterMs = val
                            onUpdate(line)
                        }
                    ), in: 0...5000, step: 100)
                    .labelsHidden()
                }
                .padding(.leading, 34)
            }
        }
        .padding(.vertical, 4)
    }
}