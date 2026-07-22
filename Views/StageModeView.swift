import SwiftUI

/// 6.3 ???????????????????????????????????????????????????????????????????????????
public struct StageModeView: View {
    public let script: Script
    @Binding public var isPresented: Bool

    @ObservedObject var ttsManager = TTSManager.shared
    @ObservedObject var dataManager = DataManager.shared

    @State private var isLocked: Bool = false
    @State private var unlockProgress: Double = 0.0

    public var body: some View {
        ZStack {
            // ??????????????????????????????            Color.black
                .ignoresSafeArea()

            VStack(spacing: 20) {
                // ?????偃???????????????????????????????                HStack {
                    Button(action: {
                        ttsManager.stop()
                        isPresented = false
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.title2)
                        Text("Current script")
                                .font(.headline)
                        }
                        .foregroundColor(.red)
                    }
                    .accessibilityLabel("??????????????")

                    Spacer()

                    Text(script.title)
                        .font(.headline)
                        .foregroundColor(.gray)
                        .lineLimit(1)

                    Spacer()

                    // ???????????
                    Button(action: {
                        withAnimation {
                            isLocked.toggle()
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: isLocked ? "lock.fill" : "lock.open.fill")
                            Text(isLocked ? "Locked" : "Unlock")
                        }
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(isLocked ? Color.red.opacity(0.8) : Color.green.opacity(0.8))
                        .foregroundColor(.white)
                        .cornerRadius(20)
                    }
                    .accessibilityLabel(isLocked ? "?????????????????????????? : "??????????????????????????)
                }
                .padding(.horizontal)
                .padding(.top, 10)

                // ????????????怏?????????                VStack(alignment: .leading, spacing: 16) {
                    // 1. ????????? (????????????????????怏??????
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("?????????????? (??\(ttsManager.currentLineIndex + 1) / \(script.lines.count) ??")
                                .font(.caption)
                                .fontWeight(.bold)
                                .foregroundColor(.yellow)
                            Spacer()
                            if ttsManager.state == .playing {
                                HStack(spacing: 4) {
                                    Circle()
                                        .fill(Color.red)
                                        .frame(width: 10, height: 10)
                                    Text("??????..")
                                        .font(.caption2)
                                        .foregroundColor(.red)
                                }
                            }
                        }

                        Text(currentLineText)
                            .font(.system(size: CGFloat(32 * dataManager.settings.fontSizeScale), weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                            .minimumScaleFactor(0.5)
                            .frame(maxWidth: .infinity, minHeight: 140, alignment: .leading)
                    }
                    .padding(24)
                    .background(
                        RoundedRectangle(cornerRadius: 20)
                            .fill(Color(red: 0.12, green: 0.12, blue: 0.14))
                            .overlay(
                                RoundedRectangle(cornerRadius: 20)
                                    .stroke(ttsManager.state == .playing ? Color.yellow : Color.gray.opacity(0.3), lineWidth: 3)
                            )
                    )
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("?????????????????(currentLineText)")

                    // 2. ???????????????(???????????????????)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("???????????")
                            .font(.caption)
                            .foregroundColor(.gray)

                        Text(nextLineText)
                            .font(.system(size: CGFloat(22 * dataManager.settings.fontSizeScale), weight: .medium, design: .rounded))
                            .foregroundColor(.gray.opacity(0.8))
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 14)
                            .fill(Color(red: 0.08, green: 0.08, blue: 0.09))
                    )
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("???????????\(nextLineText)")
                }
                .padding(.horizontal)

                Spacer()

                // ?????????????????????/ ??????怏????????????
                ZStack {
                    if isLocked {
                        VStack(spacing: 12) {
                            Image(systemName: "lock.shield.fill")
                                .font(.system(size: 44))
                                .foregroundColor(.red)
                            Text("Stage mode locked")
                                .font(.title3)
                                .fontWeight(.bold)
                                .foregroundColor(.white)
                            Text("Stage mode is locked")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.black.opacity(0.9))
                    } else {
                        VStack(spacing: 14) {
                            // ?????偃???????????????????????????/ ????????????
                            HStack(spacing: 16) {
                                StageButton(
                                    title: ttsManager.state == .playing ? "Pause" : "Play",
                                    systemImage: ttsManager.state == .playing ? "pause.fill" : "play.fill",
                                    color: ttsManager.state == .playing ? .orange : .green,
                                    accessibilityHint: "??????????????????????????????????"
                                ) {
                                    if ttsManager.state == .playing {
                                        ttsManager.pause()
                                    } else {
                                        ttsManager.playCurrentLine()
                                    }
                                }

                                StageButton(
                                    title: "Next",
                                    systemImage: "forward.fill",
                                    color: .blue,
                                    accessibilityHint: "Play the next line"
                                ) {
                                    ttsManager.nextLine()
                                }
                            }

                            // ?????????????????????? / ??????????????
                            HStack(spacing: 16) {
                                StageButton(
                                    title: "Previous",
                                    systemImage: "backward.fill",
                                    color: .purple,
                                    accessibilityHint: "Play the previous line"
                                ) {
                                    ttsManager.previousLine()
                                }

                                StageButton(
                                    title: "????????????????????",
                                    systemImage: "stop.fill",
                                    color: .red,
                                    accessibilityHint: "Stop playback"
                                ) {
                                    ttsManager.stop()
                                }
                            }
                        }
                    }
                }
                .frame(minHeight: 180)
                .padding(.horizontal)
                .padding(.bottom, 20)
            }
        }
        .onAppear {
            isLocked = dataManager.settings.isStageModeLockEnabled
            ttsManager.loadScript(script)
        }
    }

    private var currentLineText: String {
        let sorted = script.sortedLines
        guard ttsManager.currentLineIndex >= 0 && ttsManager.currentLineIndex < sorted.count else {
            return "?????????????"
        }
        return sorted[ttsManager.currentLineIndex].text
    }

    private var nextLineText: String {
        let sorted = script.sortedLines
        let nextIndex = ttsManager.currentLineIndex + 1
        guard nextIndex >= 0 && nextIndex < sorted.count else {
            return "????????????????????????????"
        }
        return sorted[nextIndex].text
    }
}