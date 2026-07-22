import SwiftUI

/// 舞台模式專用的大按鈕，提供高對比、大觸控區與無障礙 VoiceOver 標籤
public struct StageButton: View {
    public let title: String
    public let systemImage: String
    public let color: Color
    public var isEnabled: Bool = true
    public var accessibilityHint: String = ""
    public let action: () -> Void

    public init(
        title: String,
        systemImage: String,
        color: Color,
        isEnabled: Bool = true,
        accessibilityHint: String = "",
        action: @escaping () -> Void
    ) {
        self.title = title
        self.systemImage = systemImage
        self.color = color
        self.isEnabled = isEnabled
        self.accessibilityHint = accessibilityHint
        self.action = action
    }

    public var body: some View {
        Button(action: {
            if isEnabled {
                action()
            }
        }) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 28, weight: .bold))
                Text(title)
                    .font(.system(size: 24, weight: .bold, design: .rounded))
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 70)
            .background(isEnabled ? color : Color.gray.opacity(0.3))
            .foregroundColor(.white)
            .cornerRadius(16)
            .shadow(color: isEnabled ? color.opacity(0.4) : Color.clear, radius: 8, x: 0, y: 4)
        }
        .disabled(!isEnabled)
        .accessibilityLabel(title)
        .accessibilityHint(accessibilityHint)
        .accessibilityAddTraits(.isButton)
    }
}
