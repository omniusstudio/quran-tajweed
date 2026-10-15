import AppKit
import CoreText
import QuartzCore

/// The tape: one verse on one line in the muṣḥaf font. A verse wider than the strip glides along so the
/// word being recited stays near the middle; the word has a marker that slides from word to word, and
/// words the session has veiled show only a line where they stand.
final class TickerLineView: NSView {
    struct Content: Equatable {
        var surah: Int
        var basri: Int
        var veil: Double
        var peek: Bool
        var colours: Bool
        var kufi: Bool
        var dark: Bool
        var fontSize: CGFloat
    }

    var theme: TickerTheme = .paper { didSet { needsDisplay = true } }
    /// The preview line of the next verse: faded, no marker on a word, no veil lines.
    var isPreview = false
    var baseAlpha: CGFloat = 1
    /// The word sounding now in the verse shown, or nil.
    var activeProvider: (() -> Int?)?
    var isPlaying: () -> Bool = { false }

    private var verse: VerseData?
    private var content: Content?
    private var line: CTLine?
    private var lineWidth: CGFloat = 0
    private var ascent: CGFloat = 0
    private var descent: CGFloat = 0
    private var wordX: [(CGFloat, CGFloat)] = []
    private var veiled: Set<Int> = []
    private var markers: [(x0: CGFloat, x1: CGFloat, label: String)] = []

    /// Where the line sits inside this view (the whole strip is the view's height so a line can rise into place).
    var rowFrame: CGRect? { didSet { needsDisplay = true } }
    /// Progress along the verse (0…1) and whether it is a countdown for the silent gap; drawn as a hairline.
    var progressProvider: (() -> (CGFloat, Bool)?)?
    private var row: CGRect { rowFrame ?? bounds }
    private var ySh: CGFloat = 0
    private var sc: CGFloat = 1
    private var groupAlpha: CGFloat = 1
    private var groupTarget: CGFloat = 1
    private var dimTarget: CGFloat = 1
    private var dim: CGFloat = 1
    private var prog: CGFloat = 0
    private var progIsGap = false
    private var hasProgress = false
    private(set) var verseKey: String?
    private var offsetX: CGFloat = 0
    private var targetX: CGFloat = 0
    private var hlX: CGFloat = 0
    private var hlW: CGFloat = 0
    private var hlTargetX: CGFloat = 0
    private var hlTargetW: CGFloat = 0
    private var hasHighlight = false
    private var alpha: CGFloat = 1
    private var link: CADisplayLink?
    private let fade = CAGradientLayer()

    override var isFlipped: Bool { false }
    override var isOpaque: Bool { false }
    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
        layer?.masksToBounds = true
        fade.colors = [NSColor.clear.cgColor, NSColor.black.cgColor, NSColor.black.cgColor, NSColor.clear.cgColor]
        fade.locations = [0, 0.05, 0.95, 1]
        fade.startPoint = CGPoint(x: 0, y: 0.5)
        fade.endPoint = CGPoint(x: 1, y: 0.5)
        layer?.mask = fade
    }
    required init?(coder: NSCoder) { fatalError() }

    override func layout() {
        super.layout()
        fade.frame = bounds
        retarget(jump: false)
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        if window != nil, link == nil {
            let l = displayLink(target: self, selector: #selector(step(_:)))
            l.add(to: .main, forMode: .common)
            l.isPaused = true
            link = l
        }
        if window == nil { link?.invalidate(); link = nil }
    }

    // MARK: content

    /// Show a verse. `rise` brings it in from where the faded preview of the same verse stood: below, smaller, fainter.
    func show(verse: VerseData?, content: Content, rise: (dy: CGFloat, scale: CGFloat, alpha: CGFloat)? = nil) {
        let changed = verse?.b != self.verse?.b || content.surah != self.content?.surah
        if self.content == content, !changed { return }
        self.verse = verse
        self.content = content
        verseKey = verse.map { "\(content.surah):\($0.b)" }
        rebuild()
        if changed {
            if let r = rise { ySh = r.dy; sc = r.scale; alpha = r.alpha } else { ySh = 0; sc = 1; alpha = 0 }
            prog = 0
            retarget(jump: true)
        } else {
            retarget(jump: false)
        }
        wake()
    }

    /// Fade the whole line in or out (a message or a prompt takes its place).
    func setVisible(_ on: Bool) { groupTarget = on ? 1 : 0; wake() }
    /// Dim the line while the reader says the verse back.
    func setDim(_ on: Bool) { dimTarget = on ? 0.5 : 1; wake() }

    func wake() { link?.isPaused = false }

    private func rebuild() {
        guard let v = verse, let c = content else { line = nil; needsDisplay = true; return }
        let font = QuranFont.font(size: c.fontSize)
        let sp = max(c.fontSize * 0.28, 5)
        let m = NSMutableAttributedString()
        var ranges: [NSRange] = []
        var marks: [(NSRange, String)] = []
        let endAt = Dictionary(v.ends.map { ($0.0, $0.1) }, uniquingKeysWith: { a, _ in a })
        veiled = []
        for (i, word) in v.words.enumerated() {
            let hidden = !c.peek && Memo.isVeiled(surah: c.surah, basri: c.basri, word: i, fraction: c.veil)
            if hidden { veiled.insert(i) }
            let start = m.length
            for p in word {
                let color: NSColor = hidden ? .clear : (c.colours ? (p.tone.flatMap { Quran.shared.tones[$0] }.map { theme.tone($0) } ?? theme.ink) : theme.ink)
                // CoreText's own colour key keeps a fully transparent colour transparent (a veiled word)
                m.append(NSAttributedString(string: p.text, attributes: [.font: font, NSAttributedString.Key(kCTForegroundColorAttributeName as String): color.cgColor]))
            }
            ranges.append(NSRange(location: start, length: m.length - start))
            if let n = endAt[i + 1] {
                let last = i + 1 == v.words.count
                if last || c.kufi {
                    let s = m.length
                    m.append(NSAttributedString(string: " ", attributes: [.font: font, .kern: c.fontSize * 0.95]))
                    marks.append((NSRange(location: s, length: 1), arNum(c.kufi ? n : v.b)))
                }
            }
            if i < v.words.count - 1 { m.append(NSAttributedString(string: " ", attributes: [.font: font, .kern: sp * 0.4])) }
        }
        if ProcessInfo.processInfo.environment["NUTQ_DEBUG"] != nil { print("rebuild verse=\(c.surah):\(c.basri) veil=\(c.veil) peek=\(c.peek) veiled=\(veiled.sorted()) of \(v.words.count)") }
        let l = CTLineCreateWithAttributedString(m)
        var a: CGFloat = 0, d: CGFloat = 0
        lineWidth = CGFloat(CTLineGetTypographicBounds(l, &a, &d, nil))
        ascent = a; descent = d
        line = l
        func x(_ idx: Int) -> CGFloat { CTLineGetOffsetForStringIndex(l, idx, nil) }
        wordX = ranges.map { r in
            let p = x(r.location), q = x(r.location + r.length)
            return (min(p, q), max(p, q))
        }
        markers = marks.map { r, label in
            let p = x(r.location), q = x(r.location + r.length)
            return (min(p, q), max(p, q), label)
        }
        needsDisplay = true
    }

    // MARK: motion

    private func retarget(jump: Bool) {
        let V = row.width
        guard line != nil, V > 0 else { return }
        let pad: CGFloat = 14
        let active = activeProvider?().flatMap { wordX.indices.contains($0) ? $0 : nil }
        if lineWidth <= V - 2 * pad {
            targetX = (V - lineWidth) / 2
        } else {
            // upcoming words are to the left, so the word in focus sits a little right of centre
            let focus = wordX[active ?? 0]
            let want = V * 0.6 - (focus.0 + focus.1) / 2
            targetX = min(pad, max(V - pad - lineWidth, want))
        }
        if let i = active {
            hlTargetX = wordX[i].0
            hlTargetW = wordX[i].1 - wordX[i].0
            if !hasHighlight { hlX = hlTargetX; hlW = hlTargetW; hasHighlight = true }
        } else {
            hasHighlight = false
        }
        if jump { offsetX = targetX; hlX = hlTargetX; hlW = hlTargetW }
    }

    @objc private func step(_ l: CADisplayLink) {
        let dt = CGFloat(max(0.001, l.targetTimestamp - l.timestamp))
        retarget(jump: false)
        let k = 1 - exp(-dt * 9)
        offsetX += (targetX - offsetX) * k
        hlX += (hlTargetX - hlX) * (1 - exp(-dt * 16))
        hlW += (hlTargetW - hlW) * (1 - exp(-dt * 16))
        // a line rising from the preview: a quick, critically damped glide
        let kr = 1 - exp(-dt * 11)
        ySh += (0 - ySh) * kr
        sc += (1 - sc) * kr
        if alpha < 1 { alpha = min(1, alpha + dt * (ySh != 0 ? 7 : 5)) }
        groupAlpha += (groupTarget - groupAlpha) * (1 - exp(-dt * 14))
        dim += (dimTarget - dim) * (1 - exp(-dt * 8))
        if let p = progressProvider?() { prog += (p.0 - prog) * (1 - exp(-dt * 10)); progIsGap = p.1; hasProgress = true } else { hasProgress = false }
        needsDisplay = true
        let settled = abs(targetX - offsetX) < 0.2 && abs(hlTargetX - hlX) < 0.2 && abs(hlTargetW - hlW) < 0.2 && alpha >= 1
            && abs(ySh) < 0.2 && abs(1 - sc) < 0.003 && abs(groupTarget - groupAlpha) < 0.01 && abs(dimTarget - dim) < 0.01
        if settled && !isPlaying() { l.isPaused = true }
    }

    // MARK: drawing

    override func draw(_ dirtyRect: NSRect) {
        guard let ctx = NSGraphicsContext.current?.cgContext, let line else { return }
        ctx.saveGState()
        ctx.setAlpha(alpha * baseAlpha * groupAlpha * dim)
        // the line may be rising from below and growing: scale about the middle of its row
        ctx.translateBy(x: row.midX, y: row.midY + ySh)
        ctx.scaleBy(x: sc, y: sc)
        ctx.translateBy(x: -row.midX, y: -row.midY)
        let h = ascent + descent
        let base = row.minY + (row.height - h) / 2 + descent
        if hasHighlight, !isPreview {
            let r = CGRect(x: offsetX + hlX - 5, y: base - descent - 1, width: hlW + 10, height: h + 2)
            ctx.setFillColor(theme.highlight.cgColor)
            ctx.addPath(CGPath(roundedRect: r, cornerWidth: 5, cornerHeight: 5, transform: nil))
            ctx.fillPath()
        }
        // a veiled word leaves a line where it stands
        ctx.setStrokeColor(theme.rule.withAlphaComponent(0.85).cgColor)
        ctx.setLineWidth(1.8)
        ctx.setLineCap(.round)
        for i in veiled where wordX.indices.contains(i) {
            let y = base - descent * 0.2
            ctx.move(to: CGPoint(x: offsetX + wordX[i].0 + 1, y: y))
            ctx.addLine(to: CGPoint(x: offsetX + wordX[i].1 - 1, y: y))
        }
        ctx.strokePath()
        ctx.textMatrix = .identity
        ctx.textPosition = CGPoint(x: offsetX, y: base)
        CTLineDraw(line, ctx)
        // verse-end medallions
        for mk in markers {
            let cx = offsetX + (mk.x0 + mk.x1) / 2
            let r = min(row.height * 0.3, (content?.fontSize ?? 24) * 0.42)
            let circle = CGRect(x: cx - r, y: row.midY - r, width: 2 * r, height: 2 * r)
            ctx.setFillColor(theme.background.cgColor)
            ctx.fillEllipse(in: circle)
            ctx.setStrokeColor(theme.rule.cgColor)
            ctx.setLineWidth(1.2)
            ctx.strokeEllipse(in: circle)
            ctx.setLineWidth(0.6)
            ctx.strokeEllipse(in: circle.insetBy(dx: 2, dy: 2))
            let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: r * 0.95, weight: .semibold), .foregroundColor: theme.dim]
            let s = NSAttributedString(string: mk.label, attributes: attrs)
            let ln = CTLineCreateWithAttributedString(s)
            let w = CGFloat(CTLineGetTypographicBounds(ln, nil, nil, nil))
            ctx.textPosition = CGPoint(x: cx - w / 2, y: row.midY - r * 0.33)
            CTLineDraw(ln, ctx)
        }
        ctx.restoreGState()
        // progress hairline: along the verse, or the silent gap running out; it grows from the right, the way the text is read
        if hasProgress, !isPreview {
            let inset: CGFloat = 14
            let w = (row.width - 2 * inset) * min(1, max(0, prog))
            let y = row.minY + 2
            ctx.setAlpha(groupAlpha)
            ctx.setStrokeColor((progIsGap ? NSColor(srgbRed: 0.85, green: 0.62, blue: 0.16, alpha: 1) : theme.rule).withAlphaComponent(progIsGap ? 0.95 : 0.55).cgColor)
            ctx.setLineWidth(2)
            ctx.setLineCap(.round)
            ctx.move(to: CGPoint(x: row.maxX - inset, y: y))
            ctx.addLine(to: CGPoint(x: row.maxX - inset - w, y: y))
            ctx.strokePath()
        }
    }
}
