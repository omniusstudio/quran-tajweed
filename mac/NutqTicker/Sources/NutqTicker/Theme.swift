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

    /// Quiet, neutral colours that follow the menu bar or the system appearance: ink, a faint highlight, no paper.
    static func system(dark: Bool) -> TickerTheme {
        dark
            ? TickerTheme(background: NSColor(white: 0.16, alpha: 0.9), ink: NSColor(white: 1, alpha: 0.94), highlight: NSColor(white: 1, alpha: 0.17), rule: NSColor(white: 1, alpha: 0.45), dim: NSColor(white: 1, alpha: 0.6), dark: true)
            : TickerTheme(background: NSColor(white: 0.97, alpha: 0.9), ink: NSColor(white: 0, alpha: 0.86), highlight: NSColor(white: 0, alpha: 0.1), rule: NSColor(white: 0, alpha: 0.34), dim: NSColor(white: 0, alpha: 0.52), dark: false)
    }

    static var systemIsDark: Bool { NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua }

    static func current(_ mode: ThemeMode) -> TickerTheme {
        switch mode {
        case .paper: return .paper
        case .dark: return .night
        case .system: return .system(dark: systemIsDark)
        }
    }

    /// Tajwīd colours made for paper, and brighter ones for a dark strip, where the dark purples and blues would
    /// all but vanish (lifting them toward white was not enough).
    private static let darkTones: [String: String] = [
        "madd6": "#dc9cf0", "madd4": "#ff8fb4", "madd24": "#ffb25e", "madd1": "#efca62", "ghunnah": "#7fdc86",
        "iqlab": "#bfe87a", "silent": "#bdbdbd", "qalqalah": "#66c8ff", "heavy": "#8dbaff", "imalah": "#5fdccb",
        "taqlil": "#b5e8d8", "hamza": "#e0b79c",
    ]
    func tone(id: String) -> NSColor {
        if dark, let h = Self.darkTones[id] { return NSColor(hex: h) }
        return NSColor(hex: Quran.shared.tones[id] ?? "#1b2a22")
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
    /// The font's real ink, as a share of its size: it runs from 0.30 below the baseline to 1.10 above it (the
    /// typographic box, 1.76, is far taller than any verse), so rows are sized and centred on the ink.
    static let inkHeight: CGFloat = 1.40
    static let inkCentre: CGFloat = 0.404

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
