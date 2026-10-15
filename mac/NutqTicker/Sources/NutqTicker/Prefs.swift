import Foundation
import SwiftUI

enum WidthMode: String, CaseIterable, Identifiable {
    case compact, wide, full
    var id: String { rawValue }
    var label: String { self == .compact ? "متوسط" : self == .wide ? "عريض" : "كامل العرض" }
}
enum DisplayMode: String, CaseIterable, Identifiable {
    case menuBar, floating
    var id: String { rawValue }
    var label: String { self == .menuBar ? "في شريط القوائم" : "شريط عائم" }
}
enum Dock: String, CaseIterable, Identifiable {
    case top, bottom
    var id: String { rawValue }
    var label: String { self == .top ? "أعلى الشاشة" : "أسفل الشاشة" }
}
enum ThemeMode: String, CaseIterable, Identifiable {
    case system, paper, dark
    var id: String { rawValue }
    var label: String { self == .system ? "مثل النظام" : self == .paper ? "ورقي" : "داكن" }
}

/// Everything the reader can change, remembered between launches. One place, so the ticker, the menu and
/// the session engine always agree.
final class Prefs: ObservableObject {
    static let shared = Prefs()
    private let d = UserDefaults.standard

    @Published var mode: DisplayMode { didSet { d.set(mode.rawValue, forKey: "mode") } }
    @Published var barWidth: Double { didSet { d.set(barWidth, forKey: "barWidth") } }
    @Published var width: WidthMode { didSet { d.set(width.rawValue, forKey: "width") } }
    @Published var dock: Dock { didSet { d.set(dock.rawValue, forKey: "dock") } }
    @Published var theme: ThemeMode { didSet { d.set(theme.rawValue, forKey: "theme") } }
    @Published var height: Double { didSet { d.set(height, forKey: "height") } }
    @Published var fontScale: Double { didSet { d.set(fontScale, forKey: "fontScale") } }
    @Published var speed: Double { didSet { d.set(speed, forKey: "speed") } }
    @Published var volume: Double { didSet { d.set(volume, forKey: "volume") } }
    @Published var count: Int { didSet { d.set(count, forKey: "count") } }
    @Published var gap: Gap { didSet { d.set(gap.rawValue, forKey: "gap") } }
    @Published var veil: Bool { didSet { d.set(veil, forKey: "veil") } }
    @Published var link: Bool { didSet { d.set(link, forKey: "link") } }
    @Published var autoContinue: Bool { didSet { d.set(autoContinue, forKey: "autoContinue") } }
    @Published var kufi: Bool { didSet { d.set(kufi, forKey: "kufi") } }
    @Published var colours: Bool { didSet { d.set(colours, forKey: "colours") } }
    @Published var showNext: Bool { didSet { d.set(showNext, forKey: "showNext") } }
    @Published var clickThrough: Bool { didSet { d.set(clickThrough, forKey: "clickThrough") } }
    @Published var hidden: Bool { didSet { d.set(hidden, forKey: "hidden") } }
    @Published var belowMenuBar: Bool { didSet { d.set(belowMenuBar, forKey: "belowMenuBar") } }
    @Published var lastSurah: Int { didSet { d.set(lastSurah, forKey: "lastSurah") } }
    @Published var lastVerse: Int { didSet { d.set(lastVerse, forKey: "lastVerse") } }

    private init() {
        let d = UserDefaults.standard
        func flag(_ k: String, _ def: Bool) -> Bool { d.object(forKey: k) == nil ? def : d.bool(forKey: k) }
        func num(_ k: String, _ def: Double) -> Double { d.object(forKey: k) == nil ? def : d.double(forKey: k) }
        mode = DisplayMode(rawValue: d.string(forKey: "mode") ?? "") ?? .menuBar
        barWidth = num("barWidth", 560)
        width = WidthMode(rawValue: d.string(forKey: "width") ?? "") ?? .compact
        dock = Dock(rawValue: d.string(forKey: "dock") ?? "") ?? .top
        theme = ThemeMode(rawValue: d.string(forKey: "theme") ?? "") ?? .system
        height = num("height", 46)
        fontScale = num("fontScale", 1)
        speed = num("speed", 1)
        volume = num("volume", 1)
        count = Int(num("count", 100))
        gap = Gap(rawValue: d.string(forKey: "gap") ?? "") ?? .none
        veil = flag("veil", true)
        link = flag("link", true)
        autoContinue = flag("autoContinue", true)
        kufi = flag("kufi", true)
        colours = flag("colours", true)
        showNext = flag("showNext", true)
        clickThrough = flag("clickThrough", false)
        hidden = flag("hidden", false)
        belowMenuBar = flag("belowMenuBar", true)
        lastSurah = Int(num("lastSurah", 1))
        lastVerse = Int(num("lastVerse", 1))
    }
}
