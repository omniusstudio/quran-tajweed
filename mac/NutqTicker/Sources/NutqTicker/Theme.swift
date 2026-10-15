import AppKit
import CoreText

/// Colours and the Qur'an font for the strip.
struct TickerTheme {
    let background: NSColor
    let ink: NSColor
    let highlight: NSColor
    let rule: NSColor
    let dim: NSColor
    let dark: Bool

    static let paper = TickerTheme(
        background: NSColor(srgbRed: 0.984, green: 0.965, blue: 0.918, alpha: 0.97),
        ink: NSColor(srgbRed: 0.106, green: 0.165, blue: 0.133, alpha: 1),
        highlight: NSColor(srgbRed: 1, green: 0.914, blue: 0.627, alpha: 1),
        rule: NSColor(srgbRed: 0.788, green: 0.663, blue: 0.380, alpha: 1),
        dim: NSColor(srgbRed: 0.38, green: 0.44, blue: 0.41, alpha: 1),
        dark: false)
    static let night = TickerTheme(
        background: NSColor(srgbRed: 0.102, green: 0.122, blue: 0.110, alpha: 0.97),
        ink: NSColor(srgbRed: 0.937, green: 0.906, blue: 0.827, alpha: 1),
        highlight: NSColor(srgbRed: 0.341, green: 0.290, blue: 0.122, alpha: 1),
        rule: NSColor(srgbRed: 0.722, green: 0.588, blue: 0.298, alpha: 1),
        dim: NSColor(srgbRed: 0.62, green: 0.67, blue: 0.64, alpha: 1),
        dark: true)

    static func current(_ mode: ThemeMode) -> TickerTheme {
        switch mode {
        case .paper: return .paper
        case .dark: return .night
        case .auto: return NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? .night : .paper
        }
    }

    /// The tajwīd palette is made for paper; on a dark strip the colours are lifted toward white.
    func tone(_ hex: String) -> NSColor {
        let c = NSColor(hex: hex)
        return dark ? c.blended(withFraction: 0.42, of: .white) ?? c : c
    }
}

extension NSColor {
    convenience init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var v: UInt64 = 0
        Scanner(string: h).scanHexInt64(&v)
        self.init(srgbRed: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: 1)
    }
}

enum QuranFont {
    /// The Dūrī muṣḥaf font, registered for this process from the app's resources.
    static let name: String? = {
        guard let url = Resources.url("fonts/UthmanicDouri-v2.ttf") else { return nil }
        CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        let descs = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor]
        return descs?.first.flatMap { CTFontDescriptorCopyAttribute($0, kCTFontNameAttribute) as? String }
    }()

    static func font(size: CGFloat) -> NSFont {
        if let n = name, let f = NSFont(name: n, size: size) { return f }
        return NSFont(name: "Geeza Pro", size: size) ?? .systemFont(ofSize: size)
    }
}
