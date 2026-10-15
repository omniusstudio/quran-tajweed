import AppKit
import Foundation

/// Where the app's bundled data lives: Contents/Resources in the .app, or $NUTQ_RES while developing.
enum Resources {
    static func url(_ path: String) -> URL? {
        var roots: [URL] = []
        if let env = ProcessInfo.processInfo.environment["NUTQ_RES"] { roots.append(URL(fileURLWithPath: env)) }
        if let r = Bundle.main.resourceURL { roots.append(r) }
        for r in roots {
            let u = r.appendingPathComponent(path)
            if FileManager.default.fileExists(atPath: u.path) { return u }
        }
        return nil
    }
}

/// A run of letters in one tajwīd colour (or none).
struct Piece {
    let text: String
    let tone: String?
}

struct VerseData {
    /// Baṣrī number, the count the Dūrī recording follows.
    let b: Int
    /// Kūfī number printed in the muṣḥaf.
    let k: Int
    let page: Int
    let words: [[Piece]]
    /// Verse-end markers inside the verse: (words before the marker, Kūfī number).
    let ends: [(Int, Int)]

    var plainWords: [String] { words.map { $0.map(\.text).joined() } }
}

struct SurahData {
    let n: Int
    let name: String
    let header: String?
    let kufiCount: Int
    let verses: [VerseData]

    var shortName: String { name.replacingOccurrences(of: "سُورَةُ ", with: "") }
    func verse(_ basri: Int) -> VerseData? { verses.first { $0.b == basri } }
}

final class Quran {
    static let shared = Quran()
    let surahs: [SurahData]
    let tones: [String: String]

    private init() {
        guard let url = Resources.url("data/quran.json"),
              let data = try? Data(contentsOf: url),
              let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let raw = root["surahs"] as? [[String: Any]] else {
            fatalError("data/quran.json is missing from the app's resources")
        }
        tones = (root["tones"] as? [String: String]) ?? [:]
        surahs = raw.map { s in
            let verses = (s["verses"] as? [[String: Any]] ?? []).map { v -> VerseData in
                let words = (v["w"] as? [[[Any]]] ?? []).map { ps in
                    ps.map { Piece(text: $0.first as? String ?? "", tone: $0.count > 1 ? $0[1] as? String : nil) }
                }
                let ends = (v["e"] as? [[Int]] ?? []).compactMap { $0.count == 2 ? ($0[0], $0[1]) : nil }
                return VerseData(b: v["b"] as? Int ?? 0, k: v["k"] as? Int ?? 0, page: v["p"] as? Int ?? 0, words: words, ends: ends)
            }
            return SurahData(n: s["n"] as? Int ?? 0, name: s["name"] as? String ?? "", header: s["header"] as? String, kufiCount: s["kufiCount"] as? Int ?? verses.count, verses: verses)
        }
    }

    func surah(_ n: Int) -> SurahData? { n >= 1 && n <= surahs.count ? surahs[n - 1] : nil }
}

/// Arabic-Indic digits, as the app prints numbers.
func arNum(_ n: Int) -> String {
    let d = Array("٠١٢٣٤٥٦٧٨٩")
    return String(String(n).map { c in c.wholeNumberValue.map { d[$0] } ?? c })
}
