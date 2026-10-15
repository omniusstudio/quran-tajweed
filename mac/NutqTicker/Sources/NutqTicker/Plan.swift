import Foundation

enum Gap: String, Codable, CaseIterable { case none, short, recite }

/// One stretch of verses heard N times: the web app's repeat session.
struct Plan: Codable, Equatable {
    var surah: Int
    /// Baṣrī numbers of the first and last verse.
    var from: Int
    var to: Int
    var target: Int
    var gap: Gap
    /// Hide more of the text as the count climbs.
    var veil: Bool
    /// A recall of something already memorized, not new learning.
    var review: Bool = false
    /// A short pass over the previous verse and this one, to join them.
    var link: Bool = false
    var wholeSurah: Bool = false

    var keys: [String] { (from...max(from, to)).map { "\(surah):\($0)" } }
}

struct Run: Codable, Equatable {
    var plan: Plan
    var done: Int
    var completed: Bool = false
}

enum Memo {
    static let ring = 100
    static let ladderDays = [1, 3, 7, 14, 30]

    /// The share of words hidden: none for the first quarter of the count, then a third, two thirds, and all.
    static func veilFraction(done: Int, target: Int) -> Double {
        let f = target > 0 ? Double(done) / Double(target) : 0
        return f < 0.25 ? 0 : f < 0.5 ? 1.0 / 3 : f < 0.75 ? 2.0 / 3 : 1
    }

    static func stageLabel(_ f: Double) -> String {
        f == 0 ? "النص كاملًا" : f < 0.5 ? "ثلث الكلمات مخفي" : f < 1 ? "ثلثا الكلمات مخفيان" : "من الحفظ"
    }

    /// FNV-1a, the same hash the web app uses, so a word hides at the same moment on both.
    private static func hash(_ s: String) -> Double {
        var h: UInt32 = 2166136261
        for u in s.utf16 { h ^= UInt32(u); h = h &* 16777619 }
        // the same avalanche as the web app: without it neighbouring words hash alike
        h ^= h >> 16; h = h &* 0x85ebca6b
        h ^= h >> 13; h = h &* 0xc2b2ae35
        h ^= h >> 16
        return Double(h) / 4294967296.0
    }

    static func isVeiled(surah: Int, basri: Int, word: Int, fraction: Double) -> Bool {
        if fraction <= 0 { return false }
        if fraction >= 1 { return true }
        return hash("\(surah):\(basri):\(word)") < fraction
    }

    static func gapSeconds(_ g: Gap, pass: Double) -> Double {
        switch g {
        case .none: return 0
        case .short: return 2
        case .recite: return min(30, max(2, pass * 1.1))
        }
    }
}
