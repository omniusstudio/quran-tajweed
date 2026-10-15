import AppKit

// `NutqTicker --selftest` plays a short session muted and prints what the engine did.
if CommandLine.arguments.contains("--selftest") {
    Task { @MainActor in
        let r = Recitation.shared
        r.player.volume = 0
        let t0 = Date()
        var lastDone = -1
        r.startRun(Plan(surah: 112, from: 1, to: 1, target: 3, gap: .short, veil: true))
        while r.run?.completed != true {
            try? await Task.sleep(nanoseconds: 100_000_000)
            if let run = r.run, run.done != lastDone {
                lastDone = run.done
                print(String(format: "t=%.1fs done=%d phase=%@ state=%@ verse=%d time=%.2f", Date().timeIntervalSince(t0), run.done, "\(r.phase)", "\(r.state)", r.verseIndex, r.now()))
            }
            if Date().timeIntervalSince(t0) > 60 { print("TIMEOUT state=\(r.state)"); exit(1) }
        }
        print("completed; ledger reps 112:1 =", r.ledger.reps("112:1"), "days:", r.ledger.days)
        r.finish(true)
        print("memorized:", r.ledger.isDone("112:1"), "queued:", r.queued.count)
        // navigation from a cold start: next / previous must move the verse even with nothing loaded
        r.endRun()
        UserDefaults.standard.set(112, forKey: "lastSurah"); Prefs.shared.lastSurah = 112; Prefs.shared.lastVerse = 1
        r.next()
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        print("after next: verse index", r.verseIndex, "lastVerse", Prefs.shared.lastVerse)
        r.previous()
        try? await Task.sleep(nanoseconds: 1_500_000_000)
        print("after previous: verse index", r.verseIndex, "lastVerse", Prefs.shared.lastVerse)
        // and with a session paused in the background
        r.startRun(Plan(surah: 112, from: 1, to: 1, target: 5, gap: .none, veil: false))
        try? await Task.sleep(nanoseconds: 1_500_000_000)
        r.next()
        try? await Task.sleep(nanoseconds: 1_500_000_000)
        print("session after next:", r.run?.plan.from as Any, r.run?.done as Any)
        exit(0)
    }
    RunLoop.main.run()
} else {
    let app = NSApplication.shared
    let delegate = MainActor.assumeIsolated { AppDelegate() }
    app.delegate = delegate
    app.run()
}
