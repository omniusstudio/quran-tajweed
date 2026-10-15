import Foundation

struct VerseAlign {
    let basri: Int
    let start: Double
    let end: Double
    let words: [(Double, Double)]
    let safe: (Double, Double)?
    /// Where playback of the verse starts and stops (the widened span when the file has one).
    var span: (Double, Double) { safe ?? (start, end) }
}

/// When each verse and word of a sūrah sounds in the recording (the web app's alignment files).
final class SurahAlign {
    let surah: Int
    let header: (Double, Double)?
    let verses: [VerseAlign]
    let source: String?
    /// Word times from a hand-checked file or a speech recogniser can be trusted; older script-made ones are guesses.
    var wordsTrusted: Bool { source == nil || source == "hand" || source == "ctc" }

    init?(surah: Int, reciter: String) {
        guard let url = Resources.url("alignments/\(reciter)/\(String(format: "%03d", surah)).json"),
              let data = try? Data(contentsOf: url),
              let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let raw = o["verses"] as? [String: [String: Any]] else { return nil }
        self.surah = surah
        source = o["source"] as? String
        if let h = o["header"] as? [Double], h.count == 2 { header = (h[0], h[1]) } else { header = nil }
        func pair(_ x: Any?) -> (Double, Double)? { (x as? [Double]).flatMap { $0.count == 2 ? ($0[0], $0[1]) : nil } }
        verses = raw.compactMap { k, v -> VerseAlign? in
            guard let b = Int(k), let s = v["start"] as? Double, let e = v["end"] as? Double else { return nil }
            let words = (v["words"] as? [[Double]] ?? []).compactMap { $0.count == 2 ? ($0[0], $0[1]) : nil }
            return VerseAlign(basri: b, start: s, end: e, words: words, safe: pair(v["safe"]))
        }.sorted { $0.basri < $1.basri }
        if verses.isEmpty { return nil }
    }

    static func exists(surah: Int, reciter: String) -> Bool {
        Resources.url("alignments/\(reciter)/\(String(format: "%03d", surah)).json") != nil
    }

    func index(of basri: Int) -> Int? { verses.firstIndex { $0.basri == basri } }

    /// A sūrah starts at its basmalah when the reciter reads one.
    func startTime(_ i: Int) -> Double { i == 0 ? (header?.0 ?? verses[0].span.0) : verses[i].span.0 }

    /// Which verse and word sound at time t.
    func locate(_ t: Double) -> (verse: Int, word: Int)? {
        for (i, v) in verses.enumerated() where t >= v.start && t < v.end {
            for (j, w) in v.words.enumerated() where t >= w.0 && t < w.1 { return (i, j) }
            var last = 0
            for (j, w) in v.words.enumerated() where t >= w.0 { last = j }
            return (i, last)
        }
        // between verses: stay on the verse just heard, so the line does not blink
        if let i = verses.lastIndex(where: { t >= $0.start }) , t < (verses[i].span.1 + 0.6) { return (i, max(0, verses[i].words.count - 1)) }
        return nil
    }
}
