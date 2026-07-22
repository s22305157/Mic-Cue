import XCTest
@testable import MicCue

final class MicCueTests: XCTestCase {

    var dataManager: DataManager!

    override func setUpWithError() throws {
        super.setUp()
        dataManager = DataManager(loadFromDisk: false, loadSampleDataIfEmpty: false)
    }

    override func tearDownWithError() throws {
        dataManager = nil
        super.tearDown()
    }

    /// ????????????????????????????????    
func testCreateScriptAndAddLines() throws {
         let script = dataManager.createScript(title: "Test Script")
         XCTAssertEqual(script.title, "Test Script")

        let initialCount = script.lines.count
         let newLine = dataManager.addLine(to: script.id, text: "New line")

        XCTAssertNotNil(newLine)
         XCTAssertEqual(newLine?.text, "New line")

        let updatedScript = dataManager.scripts.first(where: { $0.id == script.id })
        XCTAssertEqual(updatedScript?.lines.count, initialCount + 1)
    }

    /// ?????????? (Reordering Logic)
    func testLineReordering() throws {
         let script = dataManager.createScript(title: "Reorder Test")
        let scriptId = script.id

        // ?????????????????????????        
        dataManager.moveLines(in: scriptId, from: IndexSet(integer: 0), to: 2)

        let updatedScript = dataManager.scripts.first(where: { $0.id == scriptId })
        let sorted = updatedScript?.sortedLines ?? []

        for (idx, line) in sorted.enumerated() {
            XCTAssertEqual(line.orderIndex, idx, "orderIndex ????????????????? 0 ???")
        }
    }

    /// ?????JSON ????????????????????授???????????????    
func testJSONBackupAndImport() throws {
         let script = dataManager.createScript(title: "Backup Test")
         _ = dataManager.addLine(to: script.id, text: "Backup line")

        guard let jsonExport = dataManager.exportBackupJSON() else {
            XCTFail("??????????授???? JSON ???????????")
            return
        }

        XCTAssertGreaterThan(jsonExport.count, 0)

        // ???????????        
        dataManager.deleteScript(id: script.id)
        XCTAssertNil(dataManager.scripts.first(where: { $0.id == script.id }))

        // ??????????授????????
        let success = dataManager.importBackupJSON(from: jsonExport)
        XCTAssertTrue(success, "??????????授?????JSON ?????????璈????????????????????")

        let restoredScript = dataManager.scripts.first(where: { $0.id == script.id })
        XCTAssertNotNil(restoredScript)
         XCTAssertEqual(restoredScript?.title, "Backup Test")
    }
}