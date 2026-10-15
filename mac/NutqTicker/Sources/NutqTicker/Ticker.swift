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
    private let effect = NSVisualEffectView()
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
        backdrop.wantsLayer = true
        backdrop.layer?.cornerRadius = 8
        backdrop.layer?.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        backdrop.layer?.borderWidth = 1
        effect.material = .menu
        effect.blendingMode = .behindWindow
        effect.state = .active
        effect.wantsLayer = true
        effect.layer?.cornerRadius = 8
        root.addSubview(effect)
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
        line.positionProvider = { [weak self] in self?.rec.fractionalPosition() }

        rec.objectWillChange.merge(with: prefs.objectWillChange, ui.objectWillChange, ledger.objectWillChange)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.refresh() }
            .store(in: &bag)
        NotificationCenter.default.addObserver(self, selector: #selector(screensChanged), name: NSApplication.didChangeScreenParametersNotification, object: nil)
        NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(screensChanged), name: NSWorkspace.activeSpaceDidChangeNotification, object: nil)
        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.reposition() } }
        // the pointer is polled rather than tracked: tracking areas fire exits when it moves between the strip's
        // buttons, and the controls vanished; this also works while clicks pass through the strip
        Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { [weak self] _ in MainActor.assumeIsolated { self?.pollPointer() } }
        refresh()
    }

    @objc private func screensChanged() { reposition() }

    /// The ticker lives in the menu bar's own status item; hovering it opens the bigger strip underneath.
    func attach(item: NSStatusItem, restoreIcon: @escaping () -> Void) {
        let m = MenuBarTicker(item: item, rec: rec, prefs: prefs)
        m.restoreIcon = restoreIcon
        m.onMenu = { [weak self] in self?.onMenu() }
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

    private func pollPointer() {
        let m = NSEvent.mouseLocation
        let nb = menuBar?.installed == true && (menuBar?.screenFrame?.insetBy(dx: -1, dy: -1).contains(m) ?? false)
        let np = panel.isVisible && panel.frame.insetBy(dx: -1, dy: -1).contains(m)
        if nb != barHover || np != panelHover {
            barHover = nb; panelHover = np
            if nb || np { pointerEntered() } else { pointerExited() }
            evaluateDropdown()
        }
    }

    private func pointerEntered() {
        if ui.hover { return }
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
        effect.frame = bounds
        effect.layer?.maskedCorners = prefs.dock == .top || prefs.mode == .menuBar ? [.layerMinXMinYCorner, .layerMaxXMinYCorner] : [.layerMinXMaxYCorner, .layerMaxXMaxYCorner]
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
        backdrop.layer?.backgroundColor = (prefs.theme == .system ? NSColor.clear : theme.background).cgColor
        backdrop.layer?.borderColor = theme.rule.withAlphaComponent(prefs.theme == .system ? 0.35 : 0.55).cgColor
        effect.isHidden = prefs.theme != .system
        effect.appearance = prefs.theme == .system ? nil : NSAppearance(named: theme.dark ? .darkAqua : .aqua)
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
        let range = sessionRange(cv.surah.n)
        line.show(verse: cv.verse, content: TickerLineView.Content(surah: cv.surah.n, basris: [cv.verse.b], current: 0, veil: veil, veilFrom: range.0, veilTo: range.1, peek: ui.peek, colours: prefs.colours, kufi: prefs.kufi, dark: theme.dark, fontSize: CGFloat(prefs.height) * 0.5 * CGFloat(prefs.fontScale)), rise: rise)
        line.wake()
        updateBar(cv: cv, veil: veil, theme: theme, hidden: showMessage || prompting)
        // the next verse, faded under this one
        if prefs.showNext, let next = cv.surah.verses.first(where: { $0.b > cv.verse.b }) {
            let pf = CGFloat(prefs.height) * 0.5 * CGFloat(prefs.fontScale) * TickerLayout.previewScale
            lastPreviewKey = "\(cv.surah.n):\(next.b)"
            preview.show(verse: next, content: TickerLineView.Content(surah: cv.surah.n, basris: [next.b], current: 0, veil: 0, veilFrom: 0, veilTo: -1, peek: true, colours: prefs.colours, kufi: prefs.kufi, dark: theme.dark, fontSize: pf))
            preview.isHidden = false
        } else {
            preview.isHidden = true
            lastPreviewKey = nil
        }
    }

    /// The verses a running session veils.
    private func sessionRange(_ surah: Int) -> (Int, Int) {
        if let r = rec.run, !r.completed, r.plan.veil, r.plan.surah == surah { return (r.plan.from, r.plan.to) }
        return (0, -1)
    }

    private func updateBar(cv: (surah: SurahData, verse: VerseData), veil: Double, theme: TickerTheme, hidden: Bool) {
        guard let m = menuBar, m.installed else { return }
        m.refreshAppearance()
        m.applyTheme()
        m.line.setVisible(!hidden)
        if case .gap = rec.phase { m.line.setDim(true) } else { m.line.setDim(false) }
        // the verse being read with the ones around it, so the ayat keep scrolling in
        let all = cv.surah.verses
        let i = all.firstIndex(where: { $0.b == cv.verse.b }) ?? 0
        let lo = max(0, i - 1), hi = min(all.count - 1, i + 3)
        let seq = Array(all[lo...hi])
        let range = sessionRange(cv.surah.n)
        m.line.show(verses: seq, content: TickerLineView.Content(surah: cv.surah.n, basris: seq.map(\.b), current: i - lo, veil: veil, veilFrom: range.0, veilTo: range.1, peek: ui.peek, colours: prefs.colours, kufi: prefs.kufi, dark: m.theme.dark, fontSize: min(m.height * 0.72, (m.height - 2) / QuranFont.inkHeight) * CGFloat(prefs.fontScale)))
        m.line.wake()
    }

    private var totalHeight: CGFloat { CGFloat(prefs.height) + (prefs.showNext ? TickerLayout.previewHeight(prefs.height) : 0) }
}
