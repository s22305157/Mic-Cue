import Foundation

/// 離線 JSON 手動備份匯出與匯入結構
public struct BackupData: Codable {
    public var version: String
    public var exportDate: Date
    public var scripts: [Script]
    public var settings: AppSettings

    public init(
        version: String = "1.0.0",
        exportDate: Date = Date(),
        scripts: [Script],
        settings: AppSettings
    ) {
        self.version = version
        self.exportDate = exportDate
        self.scripts = scripts
        self.settings = settings
    }
}
