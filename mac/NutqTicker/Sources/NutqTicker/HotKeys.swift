import Carbon.HIToolbox
import AppKit
import Foundation

/// System-wide shortcuts that work from any app without asking for any permission.
final class HotKeys {
    static let shared = HotKeys()
    private var actions: [UInt32: () -> Void] = [:]
    private var next: UInt32 = 1
    private var installed = false

    func register(key: Int, modifiers: Int = controlKey | optionKey, _ action: @escaping () -> Void) {
        install()
        let id = next; next += 1
        actions[id] = action
        var ref: EventHotKeyRef?
        let status = RegisterEventHotKey(UInt32(key), UInt32(modifiers), EventHotKeyID(signature: OSType(0x4E545154), id: id), GetApplicationEventTarget(), 0, &ref)
        if status != noErr { NSLog("hotkey \(key) not registered: \(status)") }
    }

    private func install() {
        guard !installed else { return }
        installed = true
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), { _, event, _ in
            var hk = EventHotKeyID()
            GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil, MemoryLayout<EventHotKeyID>.size, nil, &hk)
            DispatchQueue.main.async { HotKeys.shared.actions[hk.id]?() }
            return noErr
        }, 1, &spec, nil, nil)
    }
}
