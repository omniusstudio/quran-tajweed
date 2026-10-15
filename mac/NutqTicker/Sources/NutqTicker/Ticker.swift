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
    private let backdrop = NSView()
    private var host: FirstMouseHost<OverlayView>!
    private var bag = Set<AnyCancellable>()
    private var peekTimer: Timer?
    private var lastFrame: NSRect = .zero

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
        root.onEnter = { [weak self] in self?.pointerEntered() }
        root.onExit = { [weak self] in self?.pointerExited() }
        backdrop.wantsLayer = true
        backdrop.layer?.cornerRadius = 8
        backdrop.layer?.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        backdrop.layer?.borderWidth = 1
        root.addSubview(backdrop)
        root.addSubview(line)
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
        switch prefs.width {
        case .compact: return min(w * 0.62, 980)
        case .wide: return min(w * 0.84, 1500)
        case .full: return w
        }
    }

    func reposition() {
        guard let screen = NSScreen.screens.first else { return }
        let h = CGFloat(prefs.height)
        let w = width(for: screen)
        let top = prefs.belowMenuBar ? screen.visibleFrame.maxY : screen.frame.maxY
        let y = prefs.dock == .top ? top - h : screen.visibleFrame.minY
        let f = NSRect(x: (screen.frame.midX - w / 2).rounded(), y: y.rounded(), width: w.rounded(), height: h)
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
        line.frame = NSRect(x: TickerLayout.leftInset + 10, y: 0, width: max(80, size.width - TickerLayout.leftInset - TickerLayout.rightInset - 20), height: size.height)
        backdrop.layer?.maskedCorners = prefs.dock == .top ? [.layerMinXMinYCorner, .layerMaxXMinYCorner] : [.layerMinXMaxYCorner, .layerMaxXMaxYCorner]
    }

    // MARK: state → views

    private var displayed: (surah: SurahData, verse: VerseData)? {
        if let cv = rec.currentVerse { return cv }
        guard let s = Quran.shared.surah(prefs.lastSurah), let v = s.verse(prefs.lastVerse) ?? s.verses.first else { return nil }
        return (s, v)
    }

    func refresh() {
        if prefs.hidden { panel.orderOut(nil) } else if !panel.isVisible { reposition(); panel.orderFrontRegardless() }
        panel.ignoresMouseEvents = prefs.clickThrough
        if lastFrame.height != CGFloat(prefs.height) || abs(lastFrame.width - width(for: NSScreen.screens.first ?? NSScreen.main!)) > 1 { lastFrame = .zero; reposition() }
        let theme = TickerTheme.current(prefs.theme)
        backdrop.layer?.backgroundColor = theme.background.cgColor
        backdrop.layer?.borderColor = theme.rule.withAlphaComponent(0.55).cgColor
        line.theme = theme
        let showMessage: Bool = { if case .playing = rec.state { return false }; if case .paused = rec.state { return false }; if case .idle = rec.state { return false }; return true }()
        let prompting = rec.phase == .complete && rec.run?.completed == true
        line.isHidden = showMessage || prompting
        guard let cv = displayed else { return }
        var veil = 0.0
        if let r = rec.run, !r.completed, r.plan.veil, r.plan.surah == cv.surah.n, cv.verse.b >= r.plan.from, cv.verse.b <= r.plan.to {
            veil = Memo.veilFraction(done: r.done, target: r.plan.target)
        }
        if ProcessInfo.processInfo.environment["NUTQ_DEBUG"] != nil { print("refresh veil=\(veil) peek=\(ui.peek) run=\(String(describing: rec.run?.done)) verse=\(cv.surah.n):\(cv.verse.b)") }
        line.show(verse: cv.verse, content: TickerLineView.Content(surah: cv.surah.n, basri: cv.verse.b, veil: veil, peek: ui.peek, colours: prefs.colours, kufi: prefs.kufi, dark: theme.dark, fontSize: CGFloat(prefs.height) * 0.5 * CGFloat(prefs.fontScale)))
        line.wake()
    }
}
