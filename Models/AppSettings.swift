import Foundation

/// App 設定與舞台偏好
public struct AppSettings: Codable, Equatable {
    public var defaultVoiceIdentifier: String
    public var defaultRate: Float
    public var defaultPitch: Float
    public var fontSizeScale: Double
    public var isStageModeLockEnabled: Bool
    public var isVoiceOverFriendly: Bool
    public var isLandscapeOnly: Bool

    public init(
        defaultVoiceIdentifier: String = "",
        defaultRate: Float = 0.5,
        defaultPitch: Float = 1.0,
        fontSizeScale: Double = 1.2,
        isStageModeLockEnabled: Bool = true,
        isVoiceOverFriendly: Bool = true,
        isLandscapeOnly: Bool = false
    ) {
        self.defaultVoiceIdentifier = defaultVoiceIdentifier
        self.defaultRate = defaultRate
        self.defaultPitch = defaultPitch
        self.fontSizeScale = fontSizeScale
        self.isStageModeLockEnabled = isStageModeLockEnabled
        self.isVoiceOverFriendly = isVoiceOverFriendly
        self.isLandscapeOnly = isLandscapeOnly
    }

    public static let defaultSettings = AppSettings()
}
