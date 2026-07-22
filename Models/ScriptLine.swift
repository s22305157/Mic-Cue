import Foundation

/// 代表一句脫口秀台詞／句子
public struct ScriptLine: Identifiable, Codable, Equatable, Hashable {
    public var id: UUID
    public var scriptId: UUID
    public var text: String
    public var orderIndex: Int
    public var pauseBeforeMs: Int
    public var pauseAfterMs: Int
    public var isFavorite: Bool

    public init(
        id: UUID = UUID(),
        scriptId: UUID,
        text: String = "",
        orderIndex: Int = 0,
        pauseBeforeMs: Int = 0,
        pauseAfterMs: Int = 300,
        isFavorite: Bool = false
    ) {
        self.id = id
        self.scriptId = scriptId
        self.text = text
        self.orderIndex = orderIndex
        self.pauseBeforeMs = pauseBeforeMs
        self.pauseAfterMs = pauseAfterMs
        self.isFavorite = isFavorite
    }
}
