import AppKit
import SwiftUI

/// The ticker inside the menu bar itself: a status item as wide as you like, holding a small paper strip with
/// the verse. Nothing is covered and nothing has to move; hovering opens the bigger two-line strip just below.
@MainActor
final class MenuBarTicker: NSObject {
    let item: NSStatusItem
    let line = TickerLineView(frame: .zero)
    private let container = HoverRoot()
    private let backdrop = NSView()
    private var host: FirstMouseHost<CompactOverlay>!
    private(set) var installed = false
    var onHover: (Bool) -> Void = { _ in }
    var onMenu: () -> Void = {}
    var restoreIcon: () -> Void = {}

    static let insetRight: CGFloat = 104
    static let insetLeft: CGFloat = 40

    init(item: NSStatusItem, rec: Recitation, prefs: Prefs) {
        self.item = item
        super.init()
        container.wantsLayer = true
        backdrop.wantsLayer = true
        backdrop.layer?.cornerRadius = 6
        backdrop.layer?.borderWidth = 1
        container.addSubview(backdrop)
        container.addSubview(line)
        host = FirstMouseHost(rootView: CompactOverlay(rec: rec, prefs: prefs, onMenu: { [weak self] in self?.onMenu() }))
        host.sizingOptions = []
        container.addSubview(host)
        container.onEnter = { [weak self] in self?.onHover(true) }
        container.onExit = { [weak self] in self?.onHover(false) }
        line.isPlaying = { rec.isPlaying }
        line.activeProvider = {
            guard let p = rec.position, p.verse == rec.verseIndex else { return nil }
            return p.word
        }
    }

    /// Whether the menu bar itself is dark right now (it follows the wallpaper), for the colour of the text.
    nonisolated(unsafe) static var barDark = false
    var thickness: CGFloat { NSStatusBar.system.thickness }
    var height: CGFloat { thickness - 2 }
    var theme: TickerTheme { .system(dark: Self.barDark) }

    func refreshAppearance() {
        // the wallpaper under the strip decides the menu bar's text colour; the appearance is the fallback
        var auto = item.button?.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
        if let f = screenFrame, let screen = item.button?.window?.screen ?? NSScreen.screens.first, let dark = WallpaperProbe.isDarkUnder(f, on: screen) { auto = dark }
        let dark = Prefs.shared.barText == "light" ? true : Prefs.shared.barText == "dark" ? false : auto
        if dark != Self.barDark { Self.barDark = dark }
    }

    func install(width: CGFloat) {
        guard let b = item.button else { return }
        item.length = width
        b.image = nil
        b.title = ""
        if container.superview !== b {
            b.addSubview(container)
            installed = true
        }
        container.frame = NSRect(x: 0, y: 1, width: width, height: height)
        backdrop.frame = container.bounds
        host.frame = container.bounds
        let lw = max(60, width - Self.insetRight - Self.insetLeft)
        line.frame = NSRect(x: Self.insetLeft, y: 0, width: lw, height: height)
        line.rowFrame = NSRect(x: 0, y: 0, width: lw, height: height)
    }

    func uninstall() {
        guard installed else { return }
        container.removeFromSuperview()
        installed = false
        item.length = NSStatusItem.variableLength
        restoreIcon()
    }

    var view: NSView { container }

    /// Where the bar sits on screen, so the hover strip can open right under it.
    var screenFrame: NSRect? { item.button?.window?.frame }

    /// The strip has no background of its own: it is part of the menu bar.
    func applyTheme() {
        backdrop.layer?.backgroundColor = NSColor.clear.cgColor
        backdrop.layer?.borderWidth = 0
        line.theme = theme
    }
}

/// The small strip's overlay: the verse label, the play ring, and the question when a session ends.
struct CompactOverlay: View {
    @ObservedObject var rec: Recitation
    @ObservedObject var prefs: Prefs
    let onMenu: () -> Void
    @State private var pulse = false

    private var theme: TickerTheme { .system(dark: MenuBarTicker.barDark) }
    private var ink: Color { Color(nsColor: theme.ink) }
    private var dim: Color { Color(nsColor: theme.dim) }
    private var accent: Color { Color(nsColor: theme.dark ? NSColor(srgbRed: 0.38, green: 0.81, blue: 0.59, alpha: 1) : NSColor(srgbRed: 0.082, green: 0.38, blue: 0.239, alpha: 1)) }

    private var title: String {
        let cv = rec.currentVerse ?? { () -> (surah: SurahData, verse: VerseData)? in
            guard let s = Quran.shared.surah(prefs.lastSurah), let v = s.verse(prefs.lastVerse) ?? s.verses.first else { return nil }
            return (s, v)
        }()
        guard let cv else { return "" }
        return "\(cv.surah.shortName) \(arNum(prefs.kufi ? (cv.verse.ends.last?.1 ?? cv.verse.k) : cv.verse.b))"
    }

    private var message: String? {
        switch rec.state {
        case .loading(let f): return f.map { "جارٍ جلب التلاوة… \(arNum(Int($0 * 100)))٪" } ?? "جارٍ تجهيز التلاوة…"
        case .converting: return "تجهيز التلاوة لأول مرة…"
        case .failed(let m): return m
        default: return nil
        }
    }

    var body: some View {
        ZStack {
            Color.clear.contentShape(Rectangle()).onTapGesture { onMenu() }
            HStack(spacing: 0) {
                Text(title).font(.system(size: 11.5, weight: .semibold)).foregroundStyle(ink).lineLimit(1)
                    .frame(width: MenuBarTicker.insetRight - 12, alignment: .leading).padding(.leading, 6)
                Spacer(minLength: 0)
                ring.frame(width: MenuBarTicker.insetLeft, alignment: .center)
            }
            if let m = message { Text(m).font(.system(size: 11.5, weight: .medium)).foregroundStyle(dim).allowsHitTesting(false) }
            if rec.phase == .complete, let r = rec.run, r.completed {
                HStack(spacing: 8) {
                    Text("\(arNum(r.done)) مرة — " + (r.plan.review ? "ثبتت؟" : "حفظتها؟")).font(.system(size: 12, weight: .semibold)).foregroundStyle(ink)
                    StripButton(title: r.plan.review ? "ثبتت" : "نعم", primary: true, color: accent, ink: ink) { rec.finish(true) }
                    StripButton(title: r.plan.review ? "غدًا" : "٥٠ أخرى", color: accent, ink: ink) { if r.plan.review { rec.finish(false) } else { rec.extend(by: 50) } }
                    Button("لاحقًا") { rec.later() }.buttonStyle(.plain).foregroundStyle(dim).font(.system(size: 11))
                }
                .padding(.horizontal, 10)
                .background(RoundedRectangle(cornerRadius: 5).fill(Color(nsColor: theme.dark ? NSColor(white: 0.2, alpha: 0.95) : NSColor(white: 0.97, alpha: 0.95))))
            }
        }
        .environment(\.layoutDirection, .rightToLeft)
    }

    private var ring: some View {
        let r = rec.run
        let frac = r.map { min(1, Double($0.done) / Double(max(1, $0.plan.target))) } ?? 0
        return ZStack {
            Circle().stroke(dim.opacity(0.28), lineWidth: 2)
            if r != nil { Circle().trim(from: 0, to: frac).stroke(accent, style: StrokeStyle(lineWidth: 2, lineCap: .round)).rotationEffect(.degrees(-90)).animation(.easeOut(duration: 0.45), value: frac) }
            if let r { Text(arNum(r.done)).font(.system(size: r.done > 99 ? 7.5 : 9, weight: .bold).monospacedDigit()).foregroundStyle(ink) }
            else { Image(systemName: rec.isPlaying ? "pause.fill" : "play.fill").font(.system(size: 8.5, weight: .bold)).foregroundStyle(ink) }
        }
        .frame(width: 19, height: 19)
        .scaleEffect(pulse ? 1.18 : 1)
        .onChange(of: rec.run?.done) { _, _ in
            pulse = true
            withAnimation(.spring(response: 0.35, dampingFraction: 0.45)) { pulse = false }
        }
        .contentShape(Circle())
        .onTapGesture { rec.toggle() }
    }
}
