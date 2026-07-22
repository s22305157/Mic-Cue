// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MicCue",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "MicCue",
            targets: ["MicCue"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "MicCue",
            path: ".",
            sources: [
                "MicCueApp.swift",
                "Models",
                "Services",
                "Views"
            ]
        ),
        .testTarget(
            name: "MicCueTests",
            dependencies: ["MicCue"],
            path: "Tests"
        )
    ]
)
