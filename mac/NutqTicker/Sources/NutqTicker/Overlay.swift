import SwiftUI

/// Hover and peek state shared by the panel and its overlay.
final class TickerUI: ObservableObject {
    @Published var hover = false
    @Published var peek = false
}

enum TickerLayout {
    static let rightInset: CGFloat = 176
    /// Wide enough for the ring and all five hover buttons while a session runs (they were clipped at 152).
    static let leftInset: CGFloat = 212
    /// The second line, where the next verse waits faded.
    static func previewHeight(_ h: Double) -> CGFloat { CGFloat((h * 0.72).rounded()) }
    /// The next verse is set a little smaller than the one being read.
    static let previewScale: CGFloat = 0.8
}

/// Buttons that look the same whether or not the panel is active (a strip that never takes focus is always "inactive").
struct StripButton: View {
    let title: String
    var primary = false
    let color: Color
    let ink: Color
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title).font(.system(size: 12.5, weight: .semibold)).padding(.horizontal, 12).frame(height: 26)
                .foregroundStyle(primary ? Color.white : ink)
                .background(RoundedRectangle(cornerRadius: 5).fill(primary ? color : ink.opacity(0.1)))
        }
        .buttonStyle(.plain)
    }
}

struct IconButton: View {
    let system: String
    let label: String
    var size: CGFloat = 13
    let color: Color
    let action: () -> Void
    @State private var over = false
    var body: some View {
        Button(action: action) {
            Image(systemName: system).font(.system(size: size, weight: .semibold)).foregroundStyle(color).frame(width: 26, height: 26)
                .background(Circle().fill(over ? color.opacity(0.14) : .clear))
        }
        .buttonStyle(.plain)
        .help(label)
        .accessibilityLabel(label)
        .onHover { over = $0 }
    }
}

/// What sits over the tape: the verse label, the play button inside the count ring, the hover controls,
/// the loading message and the "did you memorize it?" prompt.
struct OverlayView: View {
    @ObservedObject var rec: Recitation
    @ObservedObject var ui: TickerUI
    @ObservedObject var prefs: Prefs
    @ObservedObject var ledger: Ledger
    let onMenu: () -> Void
    let onHide: () -> Void
    @State private var pulse = false

    private var theme: TickerTheme { TickerTheme.current(prefs.theme) }
    private var ink: Color { Color(nsColor: theme.ink) }
    private var dim: Color { Color(nsColor: theme.dim) }
    private var accent: Color { Color(nsColor: theme.dark ? NSColor(srgbRed: 0.38, green: 0.81, blue: 0.59, alpha: 1) : NSColor(srgbRed: 0.082, green: 0.38, blue: 0.239, alpha: 1)) }

    private var label: (title: String, sub: String)? {
        guard let cv = rec.currentVerse ?? fallbackVerse else { return nil }
        let n = prefs.kufi ? (cv.verse.ends.last?.1 ?? cv.verse.k) : cv.verse.b
        var sub = "الآية \(arNum(n))"
        if let r = rec.run, !r.completed, r.plan.veil {
            let stage = Memo.stageLabel(Memo.veilFraction(done: r.done, target: r.plan.target))
            sub = r.plan.review ? "مراجعة · \(stage)" : stage
        } else if rec.run == nil || rec.run?.completed == true {
            sub += " · صفحة \(arNum(cv.verse.page))"
        }
        return (cv.surah.shortName, sub)
    }

    private var fallbackVerse: (surah: SurahData, verse: VerseData)? {
        guard let s = Quran.shared.surah(prefs.lastSurah), let v = s.verse(prefs.lastVerse) ?? s.verses.first else { return nil }
        return (s, v)
    }

    private var message: String? {
        switch rec.state {
        case .loading(let f): return f.map { "جارٍ جلب التلاوة… \(arNum(Int($0 * 100)))٪" } ?? "جارٍ تجهيز التلاوة…"
        case .converting: return "تجهيز التلاوة لأول مرة…"
        case .failed(let m): return m
        default: return nil
        }
    }

    var body: some View {
        ZStack {
            // a click anywhere on the strip plays or pauses
            Color.clear.contentShape(Rectangle()).onTapGesture { rec.toggle() }
            HStack(spacing: 0) {
                chip.frame(width: TickerLayout.rightInset, alignment: .trailing)
                Spacer(minLength: 0)
                controls.frame(width: TickerLayout.leftInset, alignment: .leading)
            }
            .padding(.horizontal, 10)
            if let m = message {
                Text(m).font(.system(size: 13, weight: .medium)).foregroundStyle(dim)
            }
            if rec.phase == .complete, let r = rec.run, r.completed {
                prompt(r).transition(.opacity.combined(with: .scale(scale: 0.96)))
            }
        }
        .animation(.spring(response: 0.32, dampingFraction: 0.86), value: rec.phase == .complete)
        .padding(.bottom, prefs.showNext ? TickerLayout.previewHeight(prefs.height) : 0)
        .environment(\.layoutDirection, .rightToLeft)
        .animation(.easeOut(duration: 0.15), value: ui.hover)
    }

    private var chip: some View {
        VStack(alignment: .trailing, spacing: 1) {
            if let l = label {
                Text(l.title).font(.system(size: 14, weight: .semibold)).foregroundStyle(ink).lineLimit(1)
                if case .gap(let until) = rec.phase {
                    TimelineView(.periodic(from: .now, by: 0.25)) { ctx in
                        Text("رددها الآن · \(arNum(max(0, Int(ceil(until.timeIntervalSince(ctx.date))))))").font(.system(size: 10.5, weight: .semibold)).foregroundStyle(accent).lineLimit(1)
                    }
                } else {
                    Text(l.sub).font(.system(size: 10.5)).foregroundStyle(dim).lineLimit(1)
                }
            }
        }
        .padding(.trailing, 4)
    }

    private var ring: some View {
        let r = rec.run
        let frac = r.map { min(1, Double($0.done) / Double(max(1, $0.plan.target))) } ?? 0
        return ZStack {
            Circle().stroke(dim.opacity(0.25), lineWidth: 3)
            if r != nil { Circle().trim(from: 0, to: frac).stroke(accent, style: StrokeStyle(lineWidth: 3, lineCap: .round)).rotationEffect(.degrees(-90)).animation(.easeOut(duration: 0.45), value: frac) }
            if let r {
                if rec.isPlaying || rec.phase == .listening && rec.state == .playing {
                    Text(arNum(r.done)).font(.system(size: r.done > 99 ? 9.5 : 11.5, weight: .bold).monospacedDigit()).foregroundStyle(ink)
                } else {
                    Text(arNum(r.done)).font(.system(size: r.done > 99 ? 9.5 : 11.5, weight: .bold).monospacedDigit()).foregroundStyle(dim)
                }
            } else {
                Image(systemName: rec.isPlaying ? "pause.fill" : "play.fill").font(.system(size: 11, weight: .bold)).foregroundStyle(ink)
            }
        }
        .frame(width: 32, height: 32)
        .scaleEffect(pulse ? 1.14 : 1)
        .onChange(of: rec.run?.done) { _, _ in
            pulse = true
            withAnimation(.spring(response: 0.35, dampingFraction: 0.45)) { pulse = false }
        }
        .contentShape(Circle())
        .onTapGesture { rec.toggle() }
        .help(rec.isPlaying ? "إيقاف مؤقت" : "تشغيل")
    }

    private var controls: some View {
        HStack(spacing: 2) {
            ring
            if let r = rec.run, !r.completed {
                // the ring carries the count; pausing is a separate, visible control while a session runs
                IconButton(system: rec.isPlaying || rec.phase != .paused ? "pause.fill" : "play.fill", label: "إيقاف مؤقت / متابعة", color: ink) { rec.toggle() }
            }
            if ui.hover {
                IconButton(system: "chevron.right", label: "الآية السابقة", color: ink) { rec.previous() }
                IconButton(system: "chevron.left", label: "الآية التالية", color: ink) { rec.next() }
                IconButton(system: "slider.horizontal.3", label: "القائمة", color: ink) { onMenu() }
                IconButton(system: "xmark", label: "إخفاء الشريط (⌃⌥H)", size: 11, color: ink) { onHide() }
            }
        }
        .padding(.leading, 4)
    }

    private func prompt(_ r: Run) -> some View {
        HStack(spacing: 10) {
            Text("\(arNum(r.done)) مرة — " + (r.plan.review ? "هل ثبتت في صدرك؟" : "هل تقرؤها من حفظك؟")).font(.system(size: 13, weight: .semibold)).foregroundStyle(ink)
            StripButton(title: r.plan.review ? "ثبتت" : "حفظتها", primary: true, color: accent, ink: ink) { rec.finish(true) }
            StripButton(title: r.plan.review ? "تحتاج غدًا" : "٥٠ أخرى", color: accent, ink: ink) { if r.plan.review { rec.finish(false) } else { rec.extend(by: 50) } }
            Button("لاحقًا") { rec.later() }.buttonStyle(.plain).foregroundStyle(dim).font(.system(size: 12))
        }
        .padding(.horizontal, 14).padding(.vertical, 6)
        .background(RoundedRectangle(cornerRadius: 6).fill(Color(nsColor: theme.background)))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(accent.opacity(0.7), lineWidth: 1))
    }
}
