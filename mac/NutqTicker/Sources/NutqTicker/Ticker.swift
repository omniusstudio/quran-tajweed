import AppKit
import Combine
import SwiftUI

/// A panel that never takes keyboard focus, so clicking the strip does not pull you out of what you are typing.
final class TickerPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

/// The panel's content: reports the pointer entering and leaving the strip.
final class HoverRoot: NSView {
    var onEnter: () -> Void = {}
    var onExit: () -> Void = {}
    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        trackingAreas.forEach(removeTrackingArea)
        addTrackingArea(NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self, userInfo: nil))
    }
    override func mouseEntered(with event: NSEvent) { onEnter() }
    override func mouseExited(with event: NSEvent) { onExit() }
}

final class FirstMouseHost<Content: View>: NSHostingView<Content> {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

/// The strip itself: a borderless panel above every app and every Space, docked to an edge of the main screen.
@MainActor
final class TickerController: NSObject {
    let rec = Recitation.shared
    let prefs = Prefs.shared
    let ledger = Ledger.shared
    let ui = TickerUI()
    var onMenu: () -> Void = {}

    private(set) var panel: TickerPanel!
    private let line = TickerLineView(frame: .zero)
    private let preview = TickerLineView(frame: .zero)
    private let backdrop = NSView()
    private var host: FirstMouseHost<OverlayView>!
    private var bag = Set<AnyCancellable>()
    private var peekTimer: Timer?
    private var lastFrame: NSRect = .zero
    private var lastPreviewKey: String?
    private(set) var menuBar: MenuBarTicker?
    private var barHover = false
    private var panelHover = false
    private(set) var dropdownVisible = false
    private var dropTimer: Timer?

    func start() {
        let p = TickerPanel(contentRect: NSRect(x: 0, y: 0, width: 800, height: 46), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        p.isFloatingPanel = true
        p.level = .statusBar   // after isFloatingPanel, which resets the level to .floating
        p.hidesOnDeactivate = false
        p.becomesKeyOnlyIfNeeded = true
        p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        p.isOpaque = false
        p.backgroundColor = .clear
        p.hasShadow = true
        p.isMovable = false
        p.animationBehavior = .none
        panel = p

        let root = HoverRoot()
        root.wantsLayer = true
        root.onEnter = { [weak self] in self?.panelHover = true; self?.pointerEntered(); self?.evaluateDropdown() }
        root.onExit = { [weak self] in self?.panelHover = false; self?.pointerExited(); self?.evaluateDropdown() }
        backdrop.wantsLayer = true
        backdrop.layer?.cornerRadius = 8
        backdrop.layer?.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        backdrop.layer?.borderWidth = 1
        root.addSubview(backdrop)
        root.addSubview(line)
        preview.isPreview = true
        preview.baseAlpha = 0.5
        root.addSubview(preview)
        host = FirstMouseHost(rootView: OverlayView(rec: rec, ui: ui, prefs: prefs, ledger: ledger, onMenu: { [weak self] in self?.onMenu() }, onHide: { [weak self] in self?.prefs.hidden = true }))
        host.sizingOptions = []
        host.layer?.backgroundColor = .clear
        root.addSubview(host)
        p.contentView = root

        line.isPlaying = { [weak self] in self?.rec.isPlaying ?? false }
        line.activeProvider = { [weak self] in
            guard let self, let p = self.rec.position, p.verse == self.rec.verseIndex else { return nil }
            return p.word
        }

        rec.objectWillChange.merge(with: prefs.objectWillChange, ui.objectWillChange, ledger.objectWillChange)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.refresh() }
            .store(in: &bag)
        NotificationCenter.default.addObserver(self, selector: #selector(screensChanged), name: NSApplication.didChangeScreenParametersNotification, object: nil)
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(screensChanged), name: NSWorkspace.activeSpaceDidChangeNotification, object: nil)
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.reposition() } }
        refresh()
    }

    @objc private func screensChanged() { reposition() }

    /// The ticker lives in the menu bar's own status item; hovering it opens the bigger strip underneath.
    func attach(item: NSStatusItem, restoreIcon: @escaping () -> Void) {
        let m = MenuBarTicker(item: item, rec: rec, prefs: prefs)
        m.restoreIcon = restoreIcon
        m.onMenu = { [weak self] in self?.onMenu() }
        m.onHover = { [weak self] h in
            guard let self else { return }
            self.barHover = h
            if h { self.pointerEntered() } else { self.pointerExited() }
            self.evaluateDropdown()
        }
        menuBar = m
        refresh()
    }

    func debugDropdown() { dropdownVisible = true; lastFrame = .zero; refresh() }

    private func evaluateDropdown() {
        dropTimer?.invalidate()
        let over = barHover || panelHover
        if over, !dropdownVisible {
            dropTimer = Timer.scheduledTimer(withTimeInterval: 0.35, repeats: false) { [weak self] _ in
                MainActor.assumeIsolated {
                    guard let self, self.barHover || self.panelHover else { return }
                    self.dropdownVisible = true
                    self.lastFrame = .zero
                    self.refresh()
                }
            }
        } else if !over, dropdownVisible {
            dropTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: false) { [weak self] _ in
                MainActor.assumeIsolated {
                    guard let self, !(self.barHover || self.panelHover) else { return }
                    self.dropdownVisible = false
                    self.refresh()
                }
            }
        }
    }

    private func pointerEntered() {
        ui.hover = true
        peekTimer?.invalidate()
        // resting on the strip for a moment shows the veiled words
        peekTimer = Timer.scheduledTimer(withTimeInterval: 0.45, repeats: false) { [weak self] _ in
            MainActor.assumeIsolated { self?.ui.peek = true }
        }
    }
    private func pointerExited() {
        peekTimer?.invalidate()
        ui.hover = false
        ui.peek = false
    }

    // MARK: layout

    private func width(for screen: NSScreen) -> CGFloat {
        let w = screen.frame.width
        if prefs.mode == .menuBar { return min(w * 0.5, 840) }   // the strip that drops open under the menu bar
        switch prefs.width {
        case .compact: return min(w * 0.62, 980)
        case .wide: return min(w * 0.84, 1500)
        case .full: return w
        }
    }

    func reposition() {
        guard let screen = NSScreen.screens.first else { return }
        let h = totalHeight
        let w = width(for: screen)
        let top = prefs.belowMenuBar || prefs.mode == .menuBar ? screen.visibleFrame.maxY : screen.frame.maxY
        let y = prefs.dock == .top || prefs.mode == .menuBar ? top - h : screen.visibleFrame.minY
        var x = screen.frame.midX - w / 2
        if prefs.mode == .menuBar {
            // open right under the menu bar's strip
            if let a = menuBar?.screenFrame { x = a.midX - w / 2 }
            x = min(max(screen.frame.minX + 8, x), screen.frame.maxX - w - 8)
        }
        let f = NSRect(x: x.rounded(), y: y.rounded(), width: w.rounded(), height: h)
        if f != lastFrame {
            lastFrame = f
            panel.setFrame(f, display: true)
            layoutContent(f.size)
        }
    }

    private func layoutContent(_ size: CGSize) {
        let bounds = NSRect(origin: .zero, size: size)
        panel.contentView?.frame = bounds
        backdrop.frame = bounds
        host.frame = bounds
        let pv = prefs.showNext ? TickerLayout.previewHeight(prefs.height) : 0
        let lw = max(80, size.width - TickerLayout.leftInset - TickerLayout.rightInset - 34)
        // the tape's view spans both rows so the next verse can rise into the main row
        line.frame = NSRect(x: TickerLayout.leftInset + 24, y: 0, width: lw, height: size.height)
        line.rowFrame = NSRect(x: 0, y: pv, width: lw, height: size.height - pv)
        preview.frame = NSRect(x: TickerLayout.leftInset + 24, y: 0, width: lw, height: pv)
        preview.isHidden = pv == 0
        backdrop.layer?.maskedCorners = prefs.dock == .top ? [.layerMinXMinYCorner, .layerMaxXMinYCorner] : [.layerMinXMaxYCorner, .layerMaxXMaxYCorner]
    }

    // MARK: state → views

    private var displayed: (surah: SurahData, verse: VerseData)? {
        if let cv = rec.currentVerse { return cv }
        guard let s = Quran.shared.surah(prefs.lastSurah), let v = s.verse(prefs.lastVerse) ?? s.verses.first else { return nil }
        return (s, v)
    }

    func refresh() {
        let barMode = prefs.mode == .menuBar && menuBar != nil
        if barMode, !prefs.hidden {
            menuBar?.install(width: CGFloat(prefs.barWidth))
        } else {
            menuBar?.uninstall()
            dropdownVisible = false
        }
        let panelShown = barMode ? (dropdownVisible && !prefs.hidden) : !prefs.hidden
        if !panelShown { panel.orderOut(nil) } else if !panel.isVisible { reposition(); panel.orderFrontRegardless() }
        panel.ignoresMouseEvents = prefs.clickThrough
        if lastFrame.height != totalHeight || abs(lastFrame.width - width(for: NSScreen.screens.first ?? NSScreen.main!)) > 1 { lastFrame = .zero; reposition() }
        let theme = TickerTheme.current(prefs.theme)
        backdrop.layer?.backgroundColor = theme.background.cgColor
        backdrop.layer?.borderColor = theme.rule.withAlphaComponent(0.55).cgColor
        line.theme = theme
        preview.theme = theme
        let showMessage: Bool = { if case .playing = rec.state { return false }; if case .paused = rec.state { return false }; if case .idle = rec.state { return false }; return true }()
        let prompting = rec.phase == .complete && rec.run?.completed == true
        line.setVisible(!(showMessage || prompting))
        preview.setVisible(!(showMessage || prompting))
        if case .gap = rec.phase { line.setDim(true) } else { line.setDim(false) }
        guard let cv = displayed else { return }
        var veil = 0.0
        if let r = rec.run, !r.completed, r.plan.veil, r.plan.surah == cv.surah.n, cv.verse.b >= r.plan.from, cv.verse.b <= r.plan.to {
            veil = Memo.veilFraction(done: r.done, target: r.plan.target)
        }
        if ProcessInfo.processInfo.environment["NUTQ_DEBUG"] != nil { print("refresh veil=\(veil) peek=\(ui.peek) run=\(String(describing: rec.run?.done)) verse=\(cv.surah.n):\(cv.verse.b)") }
        // when the verse that was waiting faded below becomes the current one, it rises into place
        let key = "\(cv.surah.n):\(cv.verse.b)"
        var rise: (dy: CGFloat, scale: CGFloat, alpha: CGFloat)?
        if prefs.showNext, line.verseKey != nil, line.verseKey != key, key == lastPreviewKey, !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
            let pv = TickerLayout.previewHeight(prefs.height)
            rise = (dy: pv / 2 - (pv + (lastFrame.height - pv) / 2), scale: TickerLayout.previewScale, alpha: 0.55)
        }
        line.progressProvider = { [weak self] in self?.progress() }
        line.show(verse: cv.verse, content: TickerLineView.Content(surah: cv.surah.n, basri: cv.verse.b, veil: veil, peek: ui.peek, colours: prefs.colours, kufi: prefs.kufi, dark: theme.dark, fontSize: CGFloat(prefs.height) * 0.5 * CGFloat(prefs.fontScale)), rise: rise)
        line.wake()
        updateBar(cv: cv, veil: veil, theme: theme, hidden: showMessage || prompting)
        // the next verse, faded under this one
        if prefs.showNext, let next = cv.surah.verses.first(where: { $0.b > cv.verse.b }) {
            let pf = CGFloat(prefs.height) * 0.5 * CGFloat(prefs.fontScale) * TickerLayout.previewScale
            lastPreviewKey = "\(cv.surah.n):\(next.b)"
            preview.show(verse: next, content: TickerLineView.Content(surah: cv.surah.n, basri: next.b, veil: 0, peek: true, colours: prefs.colours, kufi: prefs.kufi, dark: theme.dark, fontSize: pf))
            preview.isHidden = false
        } else {
            preview.isHidden = true
            lastPreviewKey = nil
        }
    }

    /// 0…1 along the verse being heard, or the silent gap running out.
    private func progress() -> (CGFloat, Bool)? {
        if case .gap(let until) = rec.phase, rec.gapSpan > 0 { return (CGFloat(max(0, until.timeIntervalSinceNow) / rec.gapSpan), true) }
        guard rec.isPlaying, let a = rec.align, a.verses.indices.contains(rec.verseIndex) else { return nil }
        let v = a.verses[rec.verseIndex]
        let t = rec.now()
        return (CGFloat(min(1, max(0, (t - v.start) / max(0.1, v.end - v.start)))), false)
    }

    private func updateBar(cv: (surah: SurahData, verse: VerseData), veil: Double, theme: TickerTheme, hidden: Bool) {
        guard let m = menuBar, m.installed else { return }
        m.theme(theme)
        m.line.setVisible(!hidden)
        if case .gap = rec.phase { m.line.setDim(true) } else { m.line.setDim(false) }
        m.line.progressProvider = { [weak self] in self?.progress() }
        m.line.show(verse: cv.verse, content: TickerLineView.Content(surah: cv.surah.n, basri: cv.verse.b, veil: veil, peek: ui.peek, colours: prefs.colours, kufi: prefs.kufi, dark: theme.dark, fontSize: m.height * 0.68 * CGFloat(prefs.fontScale)))
        m.line.wake()
    }

    private var totalHeight: CGFloat { CGFloat(prefs.height) + (prefs.showNext ? TickerLayout.previewHeight(prefs.height) : 0) }
}
