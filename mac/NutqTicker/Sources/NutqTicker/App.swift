import AppKit
import SwiftUI
import Carbon.HIToolbox
import Combine

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let ticker = TickerController()
    private var statusItem: NSStatusItem!
    private let popover = NSPopover()
    private var bag = Set<AnyCancellable>()

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        ticker.onMenu = { [weak self] in self?.togglePopover() }
        ticker.start()
        setupStatusItem()
        setupHotKeys()
        Task { await Ledger.shared.sync() }
        if let spec = ProcessInfo.processInfo.environment["NUTQ_DEMO"] { Snapshot.demo(spec, ticker: ticker) }
    }

    private func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let b = statusItem.button {
            b.image = NSImage(systemSymbolName: "text.book.closed", accessibilityDescription: "نُطق")
            b.imagePosition = .imageLeading
            b.target = self
            b.action = #selector(togglePopoverAction)
        }
        popover.behavior = .transient
        popover.contentViewController = NSHostingController(rootView: ControlPanel(rec: .shared, prefs: .shared, ledger: .shared, onClose: { [weak self] in self?.popover.performClose(nil) }, onQuit: { NSApp.terminate(nil) }))
        // the count rides in the menu bar during a session, visible even when the strip is hidden
        Recitation.shared.objectWillChange.receive(on: DispatchQueue.main).sink { [weak self] _ in
            guard let self, let b = self.statusItem.button else { return }
            if let r = Recitation.shared.run, !r.completed { b.title = " \(arNum(r.done))/\(arNum(r.plan.target))" } else { b.title = "" }
        }.store(in: &bag)
    }

    @objc private func togglePopoverAction() { togglePopover() }

    func togglePopover() {
        if popover.isShown { popover.performClose(nil); return }
        guard let b = statusItem.button else { return }
        NSApp.activate(ignoringOtherApps: true)
        popover.show(relativeTo: b.bounds, of: b, preferredEdge: .minY)
    }

    private func setupHotKeys() {
        let rec = Recitation.shared
        HotKeys.shared.register(key: kVK_Space) { rec.toggle() }
        HotKeys.shared.register(key: kVK_LeftArrow) { rec.next() }        // reading runs leftwards
        HotKeys.shared.register(key: kVK_RightArrow) { rec.previous() }
        HotKeys.shared.register(key: kVK_ANSI_H) { Prefs.shared.hidden.toggle() }
        HotKeys.shared.register(key: kVK_ANSI_M) { rec.setVolume(Prefs.shared.volume > 0 ? 0 : 1) }
        HotKeys.shared.register(key: kVK_ANSI_R) { [weak self] in self?.togglePopover() }
    }

    func applicationWillTerminate(_ notification: Notification) {
        Recitation.shared.player.pause()
    }
}
