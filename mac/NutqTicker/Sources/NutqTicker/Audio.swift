import AVFoundation
import Foundation

struct Reciter {
    let id: String
    let nameAr: String
    let server: String

    static let all: [Reciter] = {
        guard let url = Resources.url("data/reciters.json"),
              let data = try? Data(contentsOf: url),
              let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let list = o["reciters"] as? [[String: Any]] else { return [] }
        return list.compactMap { r in
            guard let id = r["id"] as? String, let s = r["server"] as? String else { return nil }
            return Reciter(id: id, nameAr: r["nameAr"] as? String ?? id, server: s)
        }
    }()
    static let defaultID = "nourin_siddig"
}

enum AudioProgress { case downloading(Double), converting }

/// Finds a sūrah's recording, or fetches and converts it once. An MP4 (AAC) file seeks to the exact
/// frame, while the MP3s these recordings come as have no seek table and can land seconds off.
final class AudioStore {
    static let shared = AudioStore()
    private let fm = FileManager.default

    private var appSupport: URL { fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0] }
    private func cacheDir(_ reciter: String) -> URL {
        let u = Ledger.supportDir.appendingPathComponent("audio/\(reciter)")
        try? fm.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    private func usable(_ u: URL) -> Bool {
        ((try? fm.attributesOfItem(atPath: u.path)[.size] as? Int) ?? 0) > 10_000
    }

    /// The recording on disk if there is one, without fetching anything.
    func cached(surah: Int, reciter: String) -> URL? {
        let nnn = String(format: "%03d", surah)
        let web = appSupport.appendingPathComponent("nutq")
        let candidates = [
            web.appendingPathComponent("public/audio/\(reciter)/\(nnn).m4a"),
            web.appendingPathComponent("dist/audio/\(reciter)/\(nnn).m4a"),
            cacheDir(reciter).appendingPathComponent("\(nnn).m4a"),
        ]
        return candidates.first(where: usable)
    }

    func resolve(surah: Int, reciter: String, progress: @escaping (AudioProgress) -> Void) async throws -> URL {
        if let u = cached(surah: surah, reciter: reciter) { return u }
        let nnn = String(format: "%03d", surah)
        let dir = cacheDir(reciter)
        let m4a = dir.appendingPathComponent("\(nnn).m4a")
        let web = appSupport.appendingPathComponent("nutq/public/audio/\(reciter)/\(nnn).mp3")
        var mp3 = [web, dir.appendingPathComponent("\(nnn).mp3")].first(where: usable)
        if mp3 == nil {
            guard let rec = Reciter.all.first(where: { $0.id == reciter }), let url = URL(string: "\(rec.server)\(nnn).mp3") else {
                throw NSError(domain: "Nutq", code: 1, userInfo: [NSLocalizedDescriptionKey: "لا مصدر لهذه التلاوة"])
            }
            let dst = dir.appendingPathComponent("\(nnn).mp3")
            try await Downloader().download(url, to: dst) { progress(.downloading($0)) }
            mp3 = dst
        }
        progress(.converting)
        let asset = AVURLAsset(url: mp3!)
        guard let session = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
            return mp3!   // play the MP3 itself rather than nothing
        }
        let part = dir.appendingPathComponent("\(nnn).part.m4a")
        try? fm.removeItem(at: part)
        do {
            try await session.export(to: part, as: .m4a)
            try? fm.removeItem(at: m4a)
            try fm.moveItem(at: part, to: m4a)
            return m4a
        } catch {
            return mp3!
        }
    }
}

/// A download with progress, to a file.
final class Downloader: NSObject, URLSessionDownloadDelegate {
    private var cont: CheckedContinuation<Void, Error>?
    private var dest: URL!
    private var onProgress: ((Double) -> Void)?

    func download(_ url: URL, to dest: URL, progress: @escaping (Double) -> Void) async throws {
        self.dest = dest
        onProgress = progress
        var req = URLRequest(url: url)
        req.setValue("nutq-ticker/1.0 (local cache)", forHTTPHeaderField: "User-Agent")
        let session = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
        try await withCheckedThrowingContinuation { (c: CheckedContinuation<Void, Error>) in
            cont = c
            session.downloadTask(with: req).resume()
        }
        session.finishTasksAndInvalidate()
    }

    func urlSession(_ s: URLSession, downloadTask: URLSessionDownloadTask, didWriteData b: Int64, totalBytesWritten w: Int64, totalBytesExpectedToWrite t: Int64) {
        if t > 0 { onProgress?(Double(w) / Double(t)) }
    }
    func urlSession(_ s: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        let ok = (downloadTask.response as? HTTPURLResponse)?.statusCode == 200
        do {
            if !ok { throw NSError(domain: "Nutq", code: 2, userInfo: [NSLocalizedDescriptionKey: "تعذّر جلب التلاوة"]) }
            try? FileManager.default.removeItem(at: dest)
            try FileManager.default.moveItem(at: location, to: dest)
            cont?.resume()
        } catch {
            cont?.resume(throwing: error)
        }
        cont = nil
    }
    func urlSession(_ s: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let e = error, let c = cont { c.resume(throwing: e); cont = nil }
    }
}
