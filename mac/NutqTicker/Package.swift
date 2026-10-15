// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "NutqTicker",
    platforms: [.macOS(.v15)],
    products: [.executable(name: "NutqTicker", targets: ["NutqTicker"])],
    targets: [
        .executableTarget(name: "NutqTicker", path: "Sources/NutqTicker"),
    ],
    swiftLanguageModes: [.v5]
)
