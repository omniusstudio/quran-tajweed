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
        ticker.attach(item: statusItem, restoreIcon: { [weak self] in self?.restoreStatusIcon() })
        setupHotKeys()
        Task { await Ledger.shared.sync() }
        if let spec = ProcessInfo.processInfo.environment["NUTQ_DEMO"] { Snapshot.demo(spec, ticker: ticker) }
        if ProcessInfo.processInfo.environment["NUTQ_POPOVER"] != nil {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                self.togglePopover()
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                    let f = self.popover.contentViewController?.view.window?.frame ?? .zero
                    print("button window:", self.statusItem.button?.window?.frame ?? .zero, "popover frame:", f, "screen:", NSScreen.screens.first?.frame ?? .zero, "visible:", NSScreen.screens.first?.visibleFrame ?? .zero, "content:", self.popover.contentSize)
                    NSApp.terminate(nil)
                }
            }
        }
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
        // the size is fixed up front: a popover that grows after it is shown grows upward off the top of the screen
        popover.contentSize = NSSize(width: 392, height: 580)
        let controller = NSHostingController(rootView: ControlPanel(rec: .shared, prefs: .shared, ledger: .shared, onClose: { [weak self] in self?.popover.performClose(nil) }, onQuit: { NSApp.terminate(nil) }))
        controller.sizingOptions = []
        controller.preferredContentSize = NSSize(width: 392, height: 580)
        popover.contentViewController = controller
        // the count rides in the menu bar during a session, visible even when the strip is hidden
        Recitation.shared.objectWillChange.receive(on: DispatchQueue.main).sink { [weak self] _ in
            guard let self, let b = self.statusItem.button, self.ticker.menuBar?.installed != true else { return }
            if let r = Recitation.shared.run, !r.completed { b.title = " \(arNum(r.done))/\(arNum(r.plan.target))" } else { b.title = "" }
        }.store(in: &bag)
    }

    private func restoreStatusIcon() {
        guard let b = statusItem.button else { return }
        b.image = NSImage(systemSymbolName: "text.book.closed", accessibilityDescription: "نُطق")
        b.imagePosition = .imageLeading
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
