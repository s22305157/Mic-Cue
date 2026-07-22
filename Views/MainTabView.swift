import SwiftUI

/// ?????TabBar??????蹓嗽蹓曇澈?堊垓????
public struct MainTabView: View {
    @ObservedObject var dataManager = DataManager.shared

    public var body: some View {
        TabView {
            HomeView()
                .tabItem {
                    Label("?????殉秧", systemImage: "doc.text.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
        }
        .accentColor(.purple)
    }
}