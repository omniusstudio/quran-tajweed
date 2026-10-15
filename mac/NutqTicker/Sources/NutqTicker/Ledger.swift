import Foundation

struct MemoVerse: Codable {
    var reps: Int
    var last: Double
    var done: Bool?
    var mAt: Double?
    var reviews: Int?
    var due: Double?
}

/// What has been repeated and what is memorized: the web app's `progress.memo`, kept in a local file and
/// merged with the web app's own copy through its local server whenever that is reachable.
final class Ledger: ObservableObject {
    static let shared = Ledger()
    @Published private(set) var verses: [String: MemoVerse] = [:]
    @Published private(set) var days: [String: Int] = [:]
    /// Completed sessions per day, to count toward the web app's daily goal.
    private var completions: [String: Int] = [:]
    private let file: URL
    private var syncing = false
    private var dirty = false

    private struct Disk: Codable {
        var verses: [String: MemoVerse]
        var days: [String: Int]
        var completions: [String: Int]?
    }

    static var supportDir: URL {
        let u = ProcessInfo.processInfo.environment["NUTQ_SUPPORT"].map { URL(fileURLWithPath: $0) }
            ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("NutqTicker")
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    init(file: URL = Ledger.supportDir.appendingPathComponent("ledger.json")) {
        self.file = file
        if let data = try? Data(contentsOf: file), let disk = try? JSONDecoder().decode(Disk.self, from: data) {
            verses = disk.verses
            days = disk.days
            completions = disk.completions ?? [:]
        }
    }

    static func dayKey(_ d: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    private func save() {
        let disk = Disk(verses: verses, days: days, completions: completions)
        if let data = try? JSONEncoder().encode(disk) { try? data.write(to: file, options: .atomic) }
        dirty = true
        scheduleSync()
    }

    // MARK: changes

    func addPass(_ keys: [String], now: Date = Date()) {
        let ms = now.timeIntervalSince1970 * 1000
        for k in keys {
            var v = verses[k] ?? MemoVerse(reps: 0, last: 0)
            v.reps += 1
            v.last = ms
            verses[k] = v
        }
        days[Ledger.dayKey(now), default: 0] += 1
        save()
    }

    func markDone(_ keys: [String], now: Date = Date()) {
        let ms = now.timeIntervalSince1970 * 1000
        for k in keys {
            var v = verses[k] ?? MemoVerse(reps: 0, last: ms)
            if v.done == true { continue }
            v.done = true; v.mAt = ms; v.reviews = 0
            v.due = ms + Double(Memo.ladderDays[0]) * 86_400_000
            verses[k] = v
        }
        completions[Ledger.dayKey(now), default: 0] += 1
        save()
    }

    func reviewResult(_ keys: [String], ok: Bool, now: Date = Date()) {
        let ms = now.timeIntervalSince1970 * 1000
        for k in keys {
            guard var v = verses[k], v.done == true else { continue }
            v.mAt = ms
            if ok {
                let r = (v.reviews ?? 0) + 1
                v.reviews = r
                v.due = ms + Double(Memo.ladderDays[min(r, Memo.ladderDays.count - 1)]) * 86_400_000
            } else {
                v.reviews = 0
                v.due = ms + 86_400_000
            }
            verses[k] = v
        }
        save()
    }

    // MARK: reading

    func isDone(_ key: String) -> Bool { verses[key]?.done == true }
    func reps(_ key: String) -> Int { verses[key]?.reps ?? 0 }
    var doneCount: Int { verses.values.filter { $0.done == true }.count }
    var todayReps: Int { days[Ledger.dayKey()] ?? 0 }

    /// Memorized verses whose recall is due, as runs of consecutive verses of one sūrah.
    func dueRuns(now: Date = Date()) -> [(surah: Int, from: Int, to: Int)] {
        let ms = now.timeIntervalSince1970 * 1000
        let keys = verses.filter { $0.value.done == true && ($0.value.due ?? 0) <= ms }.keys
        var by: [Int: [Int]] = [:]
        for k in keys {
            let p = k.split(separator: ":").compactMap { Int($0) }
            if p.count == 2 { by[p[0], default: []].append(p[1]) }
        }
        var out: [(Int, Int, Int)] = []
        for s in by.keys.sorted() {
            var cur: [Int] = []
            for b in by[s]!.sorted() {
                if let l = cur.last, b != l + 1 { out.append((s, cur[0], l)); cur = [] }
                cur.append(b)
            }
            if let f = cur.first { out.append((s, f, cur.last!)) }
        }
        return out
    }

    // MARK: sync with the web app's local server

    private func scheduleSync() {
        guard !syncing, ProcessInfo.processInfo.environment["NUTQ_NOSYNC"] == nil else { return }
        syncing = true
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            await self.sync()
            self.syncing = false
            if self.dirty { self.scheduleSync() }
        }
    }

    private let endpoint = URL(string: "http://127.0.0.1:7373/__state")!

    /// Merge with the web app's copy (repetitions only grow; the memorized flag follows its latest change) and send ours back.
    @MainActor func sync() async {
        dirty = false
        var req = URLRequest(url: endpoint)
        req.timeoutInterval = 2
        guard let (data, resp) = try? await URLSession.shared.data(for: req), (resp as? HTTPURLResponse)?.statusCode == 200,
              let state = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
        let progress = state["progress"] as? [String: Any]
        if let memo = progress?["memo"] as? [String: Any] { absorb(memo) }
        let now = Date().timeIntervalSince1970 * 1000
        var daysOut: [String: Any] = [:]
        for (k, n) in completions { daysOut[k] = ["lessons": 0, "answers": 0, "correct": 0, "drills": 0, "challenges": n] }
        let vOut = (try? JSONSerialization.jsonObject(with: JSONEncoder().encode(verses))) ?? [:]
        let body: [String: Any] = [
            "v": 1,
            "progress": ["done": [String: Any](), "days": daysOut, "memo": ["verses": vOut, "days": days, "updatedAt": now], "updatedAt": now],
            "deck": [String: Any](), "settings": NSNull(), "alignments": [String: Any](),
        ]
        var put = URLRequest(url: endpoint)
        put.httpMethod = "PUT"
        put.timeoutInterval = 3
        put.httpBody = try? JSONSerialization.data(withJSONObject: body)
        _ = try? await URLSession.shared.data(for: put)
    }

    /// Take in the web app's ledger with the same rules the server uses.
    private func absorb(_ memo: [String: Any]) {
        if let remote = memo["verses"] as? [String: [String: Any]] {
            for (k, r) in remote {
                let rv = MemoVerse(reps: Int((r["reps"] as? Double) ?? 0), last: (r["last"] as? Double) ?? 0, done: r["done"] as? Bool, mAt: r["mAt"] as? Double, reviews: (r["reviews"] as? Double).map(Int.init), due: r["due"] as? Double)
                guard let cur = verses[k] else { verses[k] = rv; continue }
                let flag = (rv.mAt ?? 0) > (cur.mAt ?? 0) || ((rv.mAt ?? 0) == (cur.mAt ?? 0) && (rv.reviews ?? 0) > (cur.reviews ?? 0)) ? rv : cur
                verses[k] = MemoVerse(reps: max(cur.reps, rv.reps), last: max(cur.last, rv.last), done: flag.done, mAt: flag.mAt, reviews: flag.reviews, due: flag.due)
            }
        }
        if let rd = memo["days"] as? [String: Double] { for (k, n) in rd { days[k] = max(days[k] ?? 0, Int(n)) } }
        let disk = Disk(verses: verses, days: days, completions: completions)
        if let data = try? JSONEncoder().encode(disk) { try? data.write(to: file, options: .atomic) }
    }
}
