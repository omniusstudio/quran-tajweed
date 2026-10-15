import AVFoundation
import AppKit
import Combine
import Foundation

enum PlayState: Equatable {
    case idle
    case loading(Double?)      // downloading (fraction) or nil
    case converting
    case playing
    case paused
    case failed(String)
}

enum Phase: Equatable {
    case listening
    case gap(Date)
    case paused
    case complete
}

/// Plays a sūrah's recording, follows it verse by verse and word by word, and runs the repeat sessions.
@MainActor
final class Recitation: ObservableObject {
    static let shared = Recitation()

    let reciter = Reciter.defaultID
    let player = AVPlayer()
    let ledger = Ledger.shared
    let prefs = Prefs.shared

    @Published private(set) var surah = 0
    @Published private(set) var align: SurahAlign?
    /// Index into `align.verses` of the verse sounding (or last heard).
    @Published private(set) var verseIndex = 0
    @Published private(set) var state: PlayState = .idle
    @Published private(set) var run: Run?
    @Published private(set) var phase: Phase = .paused
    /// What starts next when this session is answered (the link pass, the next verse).
    @Published private(set) var queued: [Plan] = []
    /// How long the current silent gap is, for its countdown.
    private(set) var gapSpan: TimeInterval = 0

    private var item: AVPlayerItem?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var generation = 0
    private var gapTask: Task<Void, Never>?
    private var promptTask: Task<Void, Never>?
    private var range: (Double, Double)?

    private static let runKey = "nutq.ticker.run"

    private init() {
        if let data = UserDefaults.standard.data(forKey: Recitation.runKey), let r = try? JSONDecoder().decode(Run.self, from: data) {
            run = r
            phase = r.completed ? .complete : .paused
        }
        player.volume = ProcessInfo.processInfo.environment["NUTQ_MUTE"] != nil ? 0 : Float(prefs.volume)
        player.defaultRate = Float(prefs.speed)
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.08, preferredTimescale: 600), queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
    }

    // MARK: position

    func now() -> Double {
        let t = player.currentTime().seconds
        return t.isFinite ? t : 0
    }

    /// Where the recitation is, kept inside the stretch being repeated (a verse's widened span overlaps its neighbour's).
    var position: (verse: Int, word: Int)? {
        guard let a = align, var p = a.locate(now()) else { return nil }
        if let r = run, !r.completed, let i = a.index(of: r.plan.from), let j = a.index(of: r.plan.to) {
            if p.verse > j { p = (j, max(0, a.verses[j].words.count - 1)) }
            else if p.verse < i { p = (i, 0) }
        }
        return p
    }

    var currentVerse: (surah: SurahData, verse: VerseData)? {
        guard let a = align, let s = Quran.shared.surah(a.surah), a.verses.indices.contains(verseIndex) else { return nil }
        guard let v = s.verse(a.verses[verseIndex].basri) else { return nil }
        return (s, v)
    }

    var isPlaying: Bool { state == .playing }

    private func tick() {
        guard let a = align, let p = position else { return }
        if p.verse != verseIndex {
            verseIndex = p.verse
            prefs.lastSurah = a.surah
            prefs.lastVerse = a.verses[p.verse].basri
        }
    }

    // MARK: loading

    /// Make a sūrah's recording the current item. Returns false if it could not be had.
    private func load(_ n: Int) async -> Bool {
        if surah == n, item != nil { return true }
        guard let a = SurahAlign(surah: n, reciter: reciter) else {
            state = .failed("لا تلاوة متزامنة لهذه السورة بعد")
            return false
        }
        generation += 1
        let gen = generation
        state = .loading(nil)
        do {
            let url = try await AudioStore.shared.resolve(surah: n, reciter: reciter) { [weak self] p in
                Task { @MainActor in
                    guard let self, self.generation == gen else { return }
                    switch p {
                    case .downloading(let f): self.state = .loading(f)
                    case .converting: self.state = .converting
                    }
                }
            }
            guard generation == gen else { return false }
            let it = AVPlayerItem(url: url)
            it.audioTimePitchAlgorithm = .spectral
            if let o = endObserver { NotificationCenter.default.removeObserver(o) }
            endObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemDidPlayToEndTime, object: it, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.itemEnded() }
            }
            player.replaceCurrentItem(with: it)
            item = it
            surah = n
            align = a
            verseIndex = 0
            return true
        } catch {
            guard generation == gen else { return false }
            state = .failed((error as NSError).localizedDescription)
            return false
        }
    }

    private func seek(_ t: Double) async {
        await player.seek(to: CMTime(seconds: t, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
    }

    private func start() {
        player.defaultRate = Float(prefs.speed)
        player.play()
        state = .playing
    }

    // MARK: reading

    /// Read on from a verse, through the sūrah and into the next.
    func read(surah n: Int, from basri: Int) {
        Task {
            cancelGap()
            clearRunForRead()
            guard await load(n), let a = align else { return }
            item?.forwardPlaybackEndTime = .invalid
            let i = a.index(of: basri) ?? 0
            await seek(a.startTime(i))
            verseIndex = i
            start()
        }
    }

    private func clearRunForRead() {
        if run != nil, run?.completed == false { /* a session stays paused in the background */ }
        range = nil
    }

    /// Play / pause whatever is current; with nothing loaded, start where the reader left off.
    func toggle() {
        switch state {
        case .playing:
            pause()
        case .paused:
            resume()
        case .idle, .failed:
            if let r = run, !r.completed { resume() } else { read(surah: prefs.lastSurah, from: prefs.lastVerse) }
        case .loading, .converting:
            break
        }
    }

    func pause() {
        cancelGap()
        player.pause()
        if state == .playing { state = .paused }
        if run != nil, phase != .complete { phase = .paused }
    }

    func resume() {
        if let r = run, !r.completed {
            if case .gap = phase { cancelGap(); Task { await hear() }; return }
            Task {
                if surah != r.plan.surah || item == nil { startRun(r.plan, done: r.done); return }
                phase = .listening
                if let rg = range, now() < rg.0 - 0.5 || now() >= rg.1 { await seek(rg.0) }
                start()
            }
        } else if item != nil {
            start()
        } else {
            read(surah: prefs.lastSurah, from: prefs.lastVerse)
        }
    }

    func next() { step(+1) }
    func previous() { step(-1) }

    /// Move to the next or previous verse. With a session running it moves the session along (same count, gap and
    /// veil, counted afresh); otherwise it moves the reading, loading the recording first if nothing is loaded yet.
    private func step(_ by: Int) {
        if let r = run, !r.completed {
            let n = Quran.shared.surah(r.plan.surah)?.verses.count ?? 0
            let a = r.plan.from + by, b = r.plan.to + by
            guard a >= 1, b <= n else { return }
            var plan = r.plan
            plan.from = a; plan.to = b; plan.wholeSurah = false
            startRun(plan)
            return
        }
        Task {
            let n = align?.surah ?? prefs.lastSurah
            guard await load(n), let a = align else { return }
            let from = item != nil && state != .idle ? verseIndex : (a.index(of: prefs.lastVerse) ?? 0)
            let i = from + by
            if i < 0 || i >= a.verses.count {
                // across a sūrah boundary: read on from the neighbour
                let m = n + (i < 0 ? -1 : 1)
                guard m >= 1, m <= 114, SurahAlign.exists(surah: m, reciter: reciter) else { return }
                if let b = SurahAlign(surah: m, reciter: reciter) { read(surah: m, from: i < 0 ? b.verses[b.verses.count - 1].basri : 1) }
                return
            }
            await seek(a.startTime(i))
            verseIndex = i
            prefs.lastSurah = n
            prefs.lastVerse = a.verses[i].basri
            if state == .idle { state = .paused }
        }
    }

    func setVolume(_ v: Double) { prefs.volume = v; player.volume = Float(v) }
    func setSpeed(_ s: Double) {
        prefs.speed = s
        player.defaultRate = Float(s)
        if state == .playing { player.rate = Float(s) }
    }

    // MARK: debugging

    /// Put the engine in a given state without audio, for screenshots and tests.
    func debugApply(run r: Run?, phase p: Phase, state st: PlayState, surah n: Int, verse basri: Int) {
        if let a = SurahAlign(surah: n, reciter: reciter) { align = a; surah = n; verseIndex = a.index(of: basri) ?? 0 }
        run = r; phase = p; state = st
    }

    // MARK: sessions

    private func rangeFor(_ plan: Plan, _ a: SurahAlign) -> (Double, Double)? {
        guard let i = a.index(of: plan.from), let j = a.index(of: plan.to) else { return nil }
        let start = plan.wholeSurah ? a.startTime(i) : a.verses[i].span.0
        let end = a.verses[j].span.1
        return end > start ? (start, end) : nil
    }

    func startRun(_ plan: Plan, done: Int = 0) {
        Task {
            cancelGap()
            promptTask?.cancel()
            guard await load(plan.surah), let a = align, let rg = rangeFor(plan, a) else { return }
            range = rg
            let r = Run(plan: plan, done: done)
            setRun(r)
            item?.forwardPlaybackEndTime = CMTime(seconds: rg.1, preferredTimescale: 600)
            phase = .listening
            await seek(rg.0)
            verseIndex = a.index(of: plan.from) ?? 0
            start()
        }
    }

    private func setRun(_ r: Run?) {
        run = r
        if let r, let data = try? JSONEncoder().encode(r) { UserDefaults.standard.set(data, forKey: Recitation.runKey) }
        else { UserDefaults.standard.removeObject(forKey: Recitation.runKey) }
    }

    private func itemEnded() {
        if var r = run, !r.completed, range != nil { passEnded(&r); return }
        // reading: on into the next sūrah when it is available
        guard let a = align, a.surah < 114 else { state = .paused; return }
        read(surah: a.surah + 1, from: 1)
    }

    private func passEnded(_ r: inout Run) {
        r.done += 1
        ledger.addPass(r.plan.keys)
        if r.done >= r.plan.target {
            r.completed = true
            setRun(r)
            phase = .complete
            state = .paused
            if r.plan.link { Task { finish(true) }; return }
            NSSound(named: "Glass")?.play()
            // an unanswered prompt does not hold the session forever
            promptTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 120_000_000_000)
                if !Task.isCancelled { self?.later() }
            }
            return
        }
        setRun(r)
        let pass = (range?.1 ?? 0) - (range?.0 ?? 0)
        let gap = Memo.gapSeconds(r.plan.gap, pass: pass / max(0.5, prefs.speed))
        if gap > 0 {
            gapSpan = gap
            phase = .gap(Date().addingTimeInterval(gap))
            state = .paused
            gapTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(gap * 1_000_000_000))
                if !Task.isCancelled { await self?.hear() }
            }
        } else {
            Task { await hear() }
        }
    }

    /// One more hearing from the start of the range.
    private func hear() async {
        guard let rg = range, run?.completed == false else { return }
        phase = .listening
        await seek(rg.0)
        start()
    }

    private func cancelGap() { gapTask?.cancel(); gapTask = nil }

    /// End the session: the repetitions already counted stay in the ledger.
    func endRun() {
        cancelGap(); promptTask?.cancel()
        player.pause()
        item?.forwardPlaybackEndTime = .invalid
        range = nil
        queued = []
        setRun(nil)
        phase = .paused
        state = .paused
    }

    /// "حفظتها" (or, for a recall, "ثبتت") and what the reader decided about it.
    func finish(_ ok: Bool) {
        guard let r = run, r.completed else { return }
        promptTask?.cancel()
        if r.plan.review { ledger.reviewResult(r.plan.keys, ok: ok) } else if ok { ledger.markDone(r.plan.keys) }
        var follow: [Plan] = []
        if ok && !r.plan.review {
            let p = r.plan
            if !p.link, prefs.link, p.from > 1, ledger.isDone("\(p.surah):\(p.from - 1)") {
                follow.append(Plan(surah: p.surah, from: p.from - 1, to: p.to, target: 10, gap: .none, veil: false, review: false, link: true))
            }
            if !p.link, prefs.autoContinue, !p.wholeSurah, p.from == p.to, let a = align, a.index(of: p.to + 1) != nil {
                follow.append(Plan(surah: p.surah, from: p.to + 1, to: p.to + 1, target: prefs.count, gap: prefs.gap, veil: prefs.veil))
            }
        }
        let carried = r.plan.link ? queued : []
        endRun()
        queued = follow + carried
        advanceQueue()
    }

    /// Repeat the same stretch more times.
    func extend(by n: Int) {
        guard var r = run, r.completed else { return }
        promptTask?.cancel()
        r.plan.target += n
        r.completed = false
        setRun(r)
        startRun(r.plan, done: r.done)
    }

    func later() { endRun() }

    private func advanceQueue() {
        guard !queued.isEmpty else { return }
        let next = queued.removeFirst()
        Task {
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            startRun(next)
        }
    }
}
