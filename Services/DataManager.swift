import Foundation
import Combine

/// ?????????????????? JSON ???????????????????????
public class DataManager: ObservableObject {
    public static let shared = DataManager()

    @Published public var scripts: [Script] = []
    @Published public var settings: AppSettings = AppSettings.defaultSettings

    private let scriptsFileName = "mic_cue_scripts.json"
    private let settingsFileName = "mic_cue_settings.json"

    private var documentsDirectory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    private var scriptsFileURL: URL {
        documentsDirectory.appendingPathComponent(scriptsFileName)
    }

    private var settingsFileURL: URL {
        documentsDirectory.appendingPathComponent(settingsFileName)
    }

    private let persistenceEnabled: Bool
    public init(loadFromDisk: Bool = true, loadSampleDataIfEmpty: Bool = true) {
        self.persistenceEnabled = loadFromDisk
        if loadFromDisk {
            loadData()
        }
        if loadSampleDataIfEmpty && scripts.isEmpty {
            loadSampleData()
        }
    }

    // MARK: - ???????????????????????????????
    public func loadData() {
        // ??????????????????????????
        if FileManager.default.fileExists(atPath: scriptsFileURL.path) {
            do {
                let data = try Data(contentsOf: scriptsFileURL)
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .iso8601
                self.scripts = try decoder.decode([Script].self, from: data)
            } catch {
                print("?????????????????????????????????: \(error.localizedDescription)")
            }
        }

        // ?????????????????????
        if FileManager.default.fileExists(atPath: settingsFileURL.path) {
            do {
                let data = try Data(contentsOf: settingsFileURL)
                let decoder = JSONDecoder()
                self.settings = try decoder.decode(AppSettings.self, from: data)
            } catch {
                print("?????????????????????????????: \(error.localizedDescription)")
            }
        }
    }

    public func saveData() {
        guard persistenceEnabled else { return }
        // ?????????????
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            encoder.dateEncodingStrategy = .iso8601
            let scriptsData = try encoder.encode(scripts)
            try scriptsData.write(to: scriptsFileURL, options: .atomic)
        } catch {
            print("????????????????: \(error.localizedDescription)")
        }

        // ???????????????
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            let settingsData = try encoder.encode(settings)
            try settingsData.write(to: settingsFileURL, options: .atomic)
        } catch {
            print("???????????????????: \(error.localizedDescription)")
        }
    }

    // MARK: - ??????????CRUD ???

    @discardableResult
    public func createScript(title: String = "Untitled Script") -> Script {
        var newScript = Script(title: title)
        let sampleLines = [
            ScriptLine(scriptId: newScript.id, text: "First line", orderIndex: 0),
            ScriptLine(scriptId: newScript.id, text: "Second line", orderIndex: 1, pauseAfterMs: 500),
            ScriptLine(scriptId: newScript.id, text: "Third line", orderIndex: 2)
        ]
        newScript.lines = sampleLines
        scripts.insert(newScript, at: 0)
        saveData()
        return newScript
    }

    public func updateScript(_ script: Script) {
        if let index = scripts.firstIndex(where: { $0.id == script.id }) {
            var updated = script
            updated.updatedAt = Date()
            scripts[index] = updated
            saveData()
        }
    }

    public func deleteScript(atOffsets offsets: IndexSet) {
        scripts.remove(atOffsets: offsets)
        saveData()
    }

    public func deleteScript(id: UUID) {
        scripts.removeAll(where: { $0.id == id })
        saveData()
    }

    // MARK: - ???????????????
    public func addLine(to scriptId: UUID, text: String = "") -> ScriptLine? {
        guard let index = scripts.firstIndex(where: { $0.id == scriptId }) else { return nil }
        let maxOrder = scripts[index].lines.map { $0.orderIndex }.max() ?? -1
        let newLine = ScriptLine(scriptId: scriptId, text: text, orderIndex: maxOrder + 1)
        scripts[index].lines.append(newLine)
        scripts[index].updatedAt = Date()
        saveData()
        return newLine
    }

    public func updateLine(_ line: ScriptLine) {
        guard let scriptIndex = scripts.firstIndex(where: { $0.id == line.scriptId }) else { return }
        if let lineIndex = scripts[scriptIndex].lines.firstIndex(where: { $0.id == line.id }) {
            scripts[scriptIndex].lines[lineIndex] = line
            scripts[scriptIndex].updatedAt = Date()
            saveData()
        }
    }

    public func deleteLine(from scriptId: UUID, atOffsets offsets: IndexSet) {
        guard let scriptIndex = scripts.firstIndex(where: { $0.id == scriptId }) else { return }
        var sorted = scripts[scriptIndex].sortedLines
        sorted.remove(atOffsets: offsets)
        reindexLines(&sorted)
        scripts[scriptIndex].lines = sorted
        scripts[scriptIndex].updatedAt = Date()
        saveData()
    }

    public func moveLines(in scriptId: UUID, from source: IndexSet, to destination: Int) {
        guard let scriptIndex = scripts.firstIndex(where: { $0.id == scriptId }) else { return }
        var sorted = scripts[scriptIndex].sortedLines
        sorted.move(fromOffsets: source, toOffset: destination)
        reindexLines(&sorted)
        scripts[scriptIndex].lines = sorted
        scripts[scriptIndex].updatedAt = Date()
        saveData()
    }

    private func reindexLines(_ lines: inout [ScriptLine]) {
        for i in 0..<lines.count {
            lines[i].orderIndex = i
        }
    }

    // MARK: - ??? JSON ?????????????
    public func exportBackupJSON() -> Data? {
        let backup = BackupData(scripts: scripts, settings: settings)
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        encoder.dateEncodingStrategy = .iso8601
        return try? encoder.encode(backup)
    }

    public func importBackupJSON(from data: Data) -> Bool {
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .iso8601
            let backup = try decoder.decode(BackupData.self, from: data)

            self.scripts = backup.scripts
            self.settings = backup.settings
            saveData()
            return true
        } catch {
            print("???????????????????JSON ???????????: \(error.localizedDescription)")
            return false
        }
    }

    // MARK: - ??????????????????
    private func loadSampleData() {
        let sample1 = Script(
            title: "Mic Cue Sample Script",
            createdAt: Date(),
            updatedAt: Date(),
            lines: [
                ScriptLine(scriptId: sample1.id, text: "Welcome to Mic Cue.", orderIndex: 0, pauseAfterMs: 400),
                ScriptLine(scriptId: sample1.id, text: "This is a sample line.", orderIndex: 1, pauseAfterMs: 300),
                ScriptLine(scriptId: sample1.id, text: "Edit this line in the editor.", orderIndex: 2, pauseAfterMs: 600),
                ScriptLine(scriptId: sample1.id, text: "Ready for stage mode.", orderIndex: 3, pauseAfterMs: 200)
            ]
        )
        self.scripts = [sample1]
        saveData()
    }
}