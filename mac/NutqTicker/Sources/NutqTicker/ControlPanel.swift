import ServiceManagement
import SwiftUI

extension SurahData: Identifiable { var id: Int { n } }

private func plural(_ n: Int, _ one: String, _ two: String, _ few: String) -> String {
    n == 1 ? one : n == 2 ? two : n <= 10 ? "\(arNum(n)) \(few)" : "\(arNum(n)) \(one)"
}
func durationText(_ sec: Double) -> String {
    if sec < 90 { return plural(max(1, Int(sec.rounded())), "ثانية", "ثانيتان", "ثوانٍ") }
    if sec < 3600 { return plural(Int((sec / 60).rounded()), "دقيقة", "دقيقتان", "دقائق") }
    let h = Int(sec / 3600), m = Int((sec.truncatingRemainder(dividingBy: 3600) / 60).rounded())
    return plural(h, "ساعة", "ساعتان", "ساعات") + (m > 0 ? " و" + plural(m, "دقيقة", "دقيقتان", "دقائق") : "")
}

/// The menu-bar popover: what to recite, how to memorize it, what is memorized, and how the strip looks.
struct ControlPanel: View {
    @ObservedObject var rec: Recitation
    @ObservedObject var prefs: Prefs
    @ObservedObject var ledger: Ledger
    let onClose: () -> Void
    let onQuit: () -> Void

    @State private var surah: Int
    @State private var from: Int
    @State private var to: Int
    @State private var memorize = true
    @State private var showLook = false
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled

    init(rec: Recitation, prefs: Prefs, ledger: Ledger, onClose: @escaping () -> Void, onQuit: @escaping () -> Void) {
        self.rec = rec; self.prefs = prefs; self.ledger = ledger; self.onClose = onClose; self.onQuit = onQuit
        _surah = State(initialValue: prefs.lastSurah)
        _from = State(initialValue: prefs.lastVerse)
        _to = State(initialValue: prefs.lastVerse)
    }

    private var data: SurahData { Quran.shared.surah(surah) ?? Quran.shared.surahs[0] }
    private var available: Bool { SurahAlign.exists(surah: surah, reciter: rec.reciter) }
    private var wholeSurah: Bool { from == 1 && to == data.verses.count }
    private var plan: Plan { Plan(surah: surah, from: from, to: max(from, to), target: prefs.count, gap: prefs.gap, veil: prefs.veil, wholeSurah: wholeSurah) }
    private var accent: Color { Color(nsColor: NSColor(srgbRed: 0.082, green: 0.38, blue: 0.239, alpha: 1)) }

    private var estimate: String? {
        guard available, let a = SurahAlign(surah: surah, reciter: rec.reciter), let i = a.index(of: from), let j = a.index(of: max(from, to)) else { return nil }
        let start = wholeSurah ? a.startTime(i) : a.verses[i].span.0
        let pass = a.verses[j].span.1 - start
        guard pass > 0 else { return nil }
        let total = Double(prefs.count) * pass + Double(max(0, prefs.count - 1)) * Memo.gapSeconds(prefs.gap, pass: pass)
        return "نحو " + durationText(total / max(0.5, prefs.speed))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                if let r = rec.run { runCard(r) }
                chooser
                modeSection
                startButton
                Divider()
                progressSection
                dueSection
                DisclosureGroup(isExpanded: $showLook) { look } label: { Text("المظهر والإعدادات").font(.system(size: 13, weight: .semibold)) }
                Divider()
                HStack {
                    Text("⌃⌥ مسافة: تشغيل · ⌃⌥ ← →: الآية · ⌃⌥H: إخفاء").font(.system(size: 10.5)).foregroundStyle(.secondary)
                    Spacer()
                    Button("خروج", action: onQuit).buttonStyle(.plain).font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
            .padding(16)
        }
        .frame(width: 392, height: 580)
        .environment(\.layoutDirection, .rightToLeft)
        .onChange(of: surah) { _, _ in from = min(from, data.verses.count); to = max(from, min(to, data.verses.count)) }
    }

    // MARK: sections

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("نُطق").font(.system(size: 20, weight: .bold)).foregroundStyle(accent)
                Text("اسمع واحفظ وأنت تعمل").font(.system(size: 12)).foregroundStyle(.secondary)
            }
            Spacer()
            Button(action: { rec.toggle() }) {
                Image(systemName: rec.isPlaying ? "pause.circle.fill" : "play.circle.fill").font(.system(size: 30)).foregroundStyle(accent)
            }.buttonStyle(.plain).help("تشغيل / إيقاف")
        }
    }

    private func runCard(_ r: Run) -> some View {
        let s = Quran.shared.surah(r.plan.surah)?.shortName ?? ""
        let where_ = r.plan.from == r.plan.to ? "الآية \(arNum(r.plan.from))" : "الآيات \(arNum(r.plan.from))–\(arNum(r.plan.to))"
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(r.plan.review ? "مراجعة" : r.plan.link ? "ربط" : "جلسة حفظ").font(.system(size: 11, weight: .semibold)).foregroundStyle(accent)
                Spacer()
                Text("\(arNum(r.done)) من \(arNum(r.plan.target))").font(.system(size: 12).monospacedDigit()).foregroundStyle(.secondary)
            }
            Text("\(s) · \(where_)").font(.system(size: 14, weight: .semibold))
            ProgressView(value: Double(r.done), total: Double(max(1, r.plan.target))).tint(accent)
            HStack {
                Button(rec.isPlaying ? "إيقاف مؤقت" : "تابع") { rec.toggle() }.controlSize(.small)
                Button("أنهِ الجلسة") { rec.endRun() }.controlSize(.small)
                if !rec.queued.isEmpty { Text("التالي: \(rec.queued.count == 1 ? "آية" : "\(arNum(rec.queued.count)) خطوات")").font(.system(size: 11)).foregroundStyle(.secondary) }
            }
        }
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 6).fill(accent.opacity(0.08)))
        .overlay(RoundedRectangle(cornerRadius: 6).stroke(accent.opacity(0.5), lineWidth: 1))
    }

    private var chooser: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("ماذا تقرأ؟").font(.system(size: 12)).foregroundStyle(.secondary)
            Picker("", selection: $surah) {
                ForEach(Quran.shared.surahs) { s in
                    Text("\(arNum(s.n)) · \(s.shortName)" + (SurahAlign.exists(surah: s.n, reciter: rec.reciter) ? "" : "  (غير متاحة)")).tag(s.n)
                }
            }.labelsHidden()
            HStack(spacing: 8) {
                Picker("من", selection: $from) { ForEach(data.verses, id: \.b) { Text("الآية \(arNum(prefs.kufi ? $0.k : $0.b))").tag($0.b) } }
                    .onChange(of: from) { _, f in if to < f { to = f } }
                Picker("إلى", selection: $to) { ForEach(data.verses.filter { $0.b >= from }, id: \.b) { Text("الآية \(arNum(prefs.kufi ? $0.k : $0.b))").tag($0.b) } }
            }
            HStack(spacing: 6) {
                chip("آية") { to = from }
                chip("الصفحة") {
                    if let v = data.verse(from) {
                        let pg = data.verses.filter { $0.page == v.page }
                        if let a = pg.first, let b = pg.last { from = a.b; to = b.b }
                    }
                }
                chip("السورة") { from = 1; to = data.verses.count }
            }
        }
    }

    private func chip(_ t: String, _ action: @escaping () -> Void) -> some View {
        Button(t, action: action).controlSize(.small)
    }

    private var modeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("", selection: $memorize) {
                Text("استماع متصل").tag(false)
                Text("تكرار للحفظ").tag(true)
            }.pickerStyle(.segmented).labelsHidden()
            if memorize {
                VStack(alignment: .leading, spacing: 8) {
                    Text("كم مرة؟").font(.system(size: 12)).foregroundStyle(.secondary)
                    HStack(spacing: 6) {
                        ForEach([10, 33, 100], id: \.self) { n in
                            Button(arNum(n)) { prefs.count = n }.controlSize(.small).tint(prefs.count == n ? accent : nil).buttonStyle(.borderedProminent)
                                .opacity(prefs.count == n ? 1 : 0.55)
                        }
                        Stepper(value: $prefs.count, in: 1...1000, step: 10) { Text(arNum(prefs.count)).font(.system(size: 13).monospacedDigit()) }.controlSize(.small)
                    }
                    Text("بين المرتين").font(.system(size: 12)).foregroundStyle(.secondary)
                    Picker("", selection: $prefs.gap) {
                        Text("بلا وقفة").tag(Gap.none)
                        Text("وقفة قصيرة").tag(Gap.short)
                        Text("أعِدها أنت").tag(Gap.recite)
                    }.pickerStyle(.segmented).labelsHidden()
                    Toggle(isOn: $prefs.veil) { VStack(alignment: .leading, spacing: 1) { Text("أخفِ الكلمات تدريجيًا").font(.system(size: 13)); Text("كلما زاد العدد اختفى جزء من النص. أبقِ المؤشر على الشريط لتنظر.").font(.system(size: 10.5)).foregroundStyle(.secondary) } }
                    Toggle(isOn: $prefs.link) { Text("اربط الآية بما قبلها بعد حفظها").font(.system(size: 13)) }
                    Toggle(isOn: $prefs.autoContinue) { Text("انتقل إلى الآية التالية بعد الحفظ").font(.system(size: 13)) }
                }
            }
        }
    }

    private var startButton: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button(action: start) {
                Text(memorize ? "ابدأ · \(prefs.count == 1 ? "مرة" : prefs.count == 2 ? "مرتان" : prefs.count <= 10 ? "\(arNum(prefs.count)) مرات" : "\(arNum(prefs.count)) مرة")" : "ابدأ القراءة من الآية \(arNum(prefs.kufi ? (data.verse(from)?.k ?? from) : from))")
                    .font(.system(size: 14, weight: .semibold)).frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent).tint(accent).controlSize(.large).disabled(!available)
            if !available { Text("لا تلاوة متزامنة لهذه السورة بعد.").font(.system(size: 11)).foregroundStyle(.secondary) }
            else if memorize, let e = estimate { Text(e).font(.system(size: 11)).foregroundStyle(.secondary) }
        }
    }

    private func start() {
        prefs.lastSurah = surah; prefs.lastVerse = from
        if memorize { rec.startRun(plan) } else { rec.read(surah: surah, from: from) }
        onClose()
    }

    private var progressSection: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(arNum(ledger.doneCount)) آية محفوظة").font(.system(size: 15, weight: .semibold))
                Text(ledger.todayReps > 0 ? "اليوم \(arNum(ledger.todayReps)) تكرارًا" : "لم تكرّر اليوم بعد").font(.system(size: 11)).foregroundStyle(.secondary)
            }
            Spacer()
        }
    }

    @ViewBuilder private var dueSection: some View {
        let due = ledger.dueRuns()
        if !due.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("تنتظر المراجعة").font(.system(size: 12, weight: .semibold)).foregroundStyle(accent)
                ForEach(Array(due.prefix(4).enumerated()), id: \.offset) { _, r in
                    HStack {
                        Text("\(Quran.shared.surah(r.surah)?.shortName ?? "") · \(r.from == r.to ? "الآية \(arNum(r.from))" : "الآيات \(arNum(r.from))–\(arNum(r.to))")").font(.system(size: 12.5))
                        Spacer()
                        Button("راجع ×١٠") {
                            rec.startRun(Plan(surah: r.surah, from: r.from, to: r.to, target: 10, gap: .none, veil: false, review: true, wholeSurah: false))
                            onClose()
                        }.controlSize(.small)
                    }
                }
            }
        }
    }

    private var look: some View {
        VStack(alignment: .leading, spacing: 10) {
            Picker("مكان الشريط", selection: $prefs.mode) { ForEach(DisplayMode.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented)
            if prefs.mode == .menuBar {
                HStack { Text("عرض الشريط في القائمة").font(.system(size: 12)); Slider(value: $prefs.barWidth, in: 320...1000, step: 20) }
                Text("أبقِ المؤشر عليه لحظة فيفتح الشريط الكبير تحته، ويُغلق حين تبتعد.").font(.system(size: 10.5)).foregroundStyle(.secondary)
            }
            Picker("العرض", selection: $prefs.width) { ForEach(WidthMode.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented)
            Picker("الموضع", selection: $prefs.dock) { ForEach(Dock.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented)
            Picker("السمة", selection: $prefs.theme) { ForEach(ThemeMode.allCases) { Text($0.label).tag($0) } }.pickerStyle(.segmented)
            HStack { Text("الارتفاع").font(.system(size: 12)); Slider(value: $prefs.height, in: 36...80, step: 2) }
            HStack { Text("حجم الخط").font(.system(size: 12)); Slider(value: $prefs.fontScale, in: 0.7...1.5, step: 0.05) }
            HStack { Text("الصوت").font(.system(size: 12)); Slider(value: Binding(get: { prefs.volume }, set: { rec.setVolume($0) }), in: 0...1) }
            Picker("السرعة", selection: Binding(get: { prefs.speed }, set: { rec.setSpeed($0) })) {
                Text("٠٫٧٥×").tag(0.75); Text("١×").tag(1.0); Text("١٫٢٥×").tag(1.25)
            }.pickerStyle(.segmented)
            Toggle("ألوان التجويد", isOn: $prefs.colours)
            Toggle("الآية التالية باهتة تحت الحالية", isOn: $prefs.showNext)
            Toggle("ترقيم الآيات الكوفي (وإلا البصري)", isOn: $prefs.kufi)
            Toggle("تحت شريط القوائم", isOn: $prefs.belowMenuBar)
            Toggle("مرّر النقرات عبر الشريط", isOn: $prefs.clickThrough)
            Toggle("افتح عند تسجيل الدخول", isOn: Binding(get: { launchAtLogin }, set: { on in
                launchAtLogin = on
                do { if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() } } catch { launchAtLogin = !on }
            }))
        }
        .font(.system(size: 13))
        .padding(.top, 6)
    }
}
