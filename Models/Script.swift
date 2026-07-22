import Foundation

/// ??????釭??????殉秧??????鈭??
public struct Script: Identifiable, Codable, Equatable, Hashable {
    public var id: UUID
    public var title: String
    public var createdAt: Date
    public var updatedAt: Date
    public var isArchived: Bool
    public var lines: [ScriptLine]

    public init(
        id: UUID = UUID(),
        title: String = "Untitled Script",
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        isArchived: Bool = false,
        lines: [ScriptLine] = []
    ) {
        self.id = id
        self.title = title
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.isArchived = isArchived
        self.lines = lines
    }

    /// ??orderIndex ????綽??鈭??謅?
    public var sortedLines: [ScriptLine] {
        return lines.sorted { $0.orderIndex < $1.orderIndex }
    }
}