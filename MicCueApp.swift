import SwiftUI

@main
struct MicCueApp: App {
    @StateObject private var dataManager = DataManager.shared
    @StateObject private var ttsManager = TTSManager.shared

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .environmentObject(dataManager)
                .environmentObject(ttsManager)
        }
    }
}
