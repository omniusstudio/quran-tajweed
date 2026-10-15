import AppKit
import SwiftUI

/// Renders the strip and the menu panel to PNG files, for checking the design without a screen recording.
@MainActor
enum Snapshot {
    static func write(_ view: NSView, to path: String) {
        view.layoutSubtreeIfNeeded()
        view.displayIfNeeded()
        guard let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { return }
        view.cacheDisplay(in: view.bounds, to: rep)
        try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
    }

    /// NUTQ_DEMO=<scenario>:<out.png> — idle | hover | veil | gap | prompt | loading
    static func demo(_ spec: String, ticker: TickerController) {
        let parts = spec.split(separator: ":", maxSplits: 1).map(String.init)
        let scenario = parts[0], out = parts.count > 1 ? parts[1] : "/tmp/nutq-strip.png"
        let rec = Recitation.shared
        let base = Plan(surah: 2, from: 255, to: 255, target: 100, gap: .recite, veil: true)
        switch scenario {
        case "play":
            // a real muted session: the highlight should be moving when the picture is taken
            Prefs.shared.lastSurah = 112; Prefs.shared.lastVerse = 1
            rec.startRun(Plan(surah: 112, from: 1, to: 2, target: 3, gap: .none, veil: false))
            DispatchQueue.main.asyncAfter(deadline: .now() + 7.5) {
                if let v = ticker.panel.contentView { write(v, to: out) }
                print("done=\(rec.run?.done ?? -1) state=\(rec.state) level=\(ticker.panel.level.rawValue)")
                NSApp.terminate(nil)
            }
            return
        case "bar", "bar-run", "bar-prompt":
            // the menu-bar strip, and the strip that drops open under it
            Prefs.shared.lastSurah = 2; Prefs.shared.lastVerse = 255
            if scenario == "bar-run" { rec.debugApply(run: Run(plan: base, done: 52), phase: .listening, state: .paused, surah: 2, verse: 255) }
            if scenario == "bar-prompt" { rec.debugApply(run: Run(plan: Plan(surah: 112, from: 1, to: 1, target: 100, gap: .none, veil: true), done: 100, completed: true), phase: .complete, state: .paused, surah: 112, verse: 1) }
            ticker.refresh()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                if let v = ticker.menuBar?.view { write(v, to: out) }
                ticker.debugDropdown()
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                    if let v = ticker.panel.contentView { write(v, to: out.replacingOccurrences(of: ".png", with: "-drop.png")) }
                    print("bar window:", ticker.menuBar?.screenFrame ?? .zero, "panel:", ticker.panel.frame, "barDark:", MenuBarTicker.barDark)
                    NSApp.terminate(nil)
                }
            }
            return
        case "barflow":
            // the menu-bar tape across a verse boundary: nothing should jump
            Prefs.shared.lastSurah = 112; Prefs.shared.lastVerse = 1
            ticker.refresh()
            rec.read(surah: 112, from: 1)
            var frame = 0
            var started = false
            Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { t in
                MainActor.assumeIsolated {
                    if !started, rec.verseIndex == 1 { started = true }
                    if started, frame < 6, let v = ticker.menuBar?.view {
                        write(v, to: out.replacingOccurrences(of: ".png", with: "\(frame).png"))
                        frame += 1
                    }
                    if frame >= 6 || (!started && rec.now() > 12) { t.invalidate(); NSApp.terminate(nil) }
                }
            }
            return
        case "rise":
            // frames of the next verse rising into the main row, as the recitation crosses from one verse to the next
            Prefs.shared.lastSurah = 112; Prefs.shared.lastVerse = 1
            rec.read(surah: 112, from: 1)
            var frame = 0
            var started = false
            Timer.scheduledTimer(withTimeInterval: 0.06, repeats: true) { t in
                MainActor.assumeIsolated {
                    if !started, rec.verseIndex == 1 { started = true }
                    if started, frame < 8 {
                        if let v = ticker.panel.contentView { write(v, to: out.replacingOccurrences(of: ".png", with: "\(frame).png")) }
                        frame += 1
                    }
                    if frame >= 8 || (!started && rec.now() > 12) { t.invalidate(); NSApp.terminate(nil) }
                }
            }
            return
        case "click":
            // a real mouse click on the play ring, delivered to the panel the way the system would
            Prefs.shared.lastSurah = 112; Prefs.shared.lastVerse = 1
            ticker.refresh()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                @MainActor func click(_ type: NSEvent.EventType) {
                    let e = NSEvent.mouseEvent(with: type, location: NSPoint(x: 141, y: 23), modifierFlags: [], timestamp: ProcessInfo.processInfo.systemUptime, windowNumber: ticker.panel.windowNumber, context: nil, eventNumber: 0, clickCount: 1, pressure: 1)!
                    ticker.panel.sendEvent(e)
                }
                click(.leftMouseDown); click(.leftMouseUp)
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    print("after click: state=\(rec.state) playing=\(rec.isPlaying) time=\(rec.now())")
                    if let v = ticker.panel.contentView { write(v, to: out) }
                    NSApp.terminate(nil)
                }
            }
            return
        case "hover": ticker.ui.hover = true
        case "veil": rec.debugApply(run: Run(plan: base, done: 52), phase: .listening, state: .paused, surah: 2, verse: 255)
        case "veil3": rec.debugApply(run: Run(plan: base, done: 80), phase: .listening, state: .paused, surah: 2, verse: 255)
        case "gap": rec.debugApply(run: Run(plan: base, done: 12), phase: .gap(Date().addingTimeInterval(8)), state: .paused, surah: 112, verse: 1)
        case "prompt": rec.debugApply(run: Run(plan: Plan(surah: 112, from: 1, to: 1, target: 100, gap: .none, veil: true), done: 100, completed: true), phase: .complete, state: .paused, surah: 112, verse: 1)
        case "loading": rec.debugApply(run: nil, phase: .paused, state: .loading(0.4), surah: 2, verse: 255)
        case "dark":
            Prefs.shared.theme = .dark
            rec.debugApply(run: Run(plan: base, done: 30), phase: .listening, state: .paused, surah: 2, verse: 255)
        case "long": Prefs.shared.lastSurah = 2; Prefs.shared.lastVerse = 282
        default: Prefs.shared.lastSurah = 112; Prefs.shared.lastVerse = 1
        }
        ticker.refresh()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            if let v = ticker.panel.contentView { write(v, to: out) }
            if scenario == "idle" || scenario == "menu" { writePanel(to: out.replacingOccurrences(of: ".png", with: "-menu.png")) }
            NSApp.terminate(nil)
        }
    }

    static func writePanel(to path: String) {
        let host = NSHostingView(rootView: ControlPanel(rec: .shared, prefs: .shared, ledger: .shared, onClose: {}, onQuit: {}))
        host.frame = NSRect(x: 0, y: 0, width: 392, height: 580)
        host.appearance = NSAppearance(named: .aqua)
        let win = NSWindow(contentRect: host.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        win.contentView = host
        write(host, to: path)
    }
}
