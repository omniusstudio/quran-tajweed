import { useEffect, useState } from 'react';
import { resetProgress } from '../content/progress';
import { Icon, type IconName } from '../ui/icons';
import { useSettings, type Settings, type Theme, type Motion } from '../ui/settings';
import { sfx } from '../ui/sound';
import { onSyncStatus, syncNow, syncStatus } from '../ui/sync';
import { arNum } from './shared';

function Segment<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string; icon?: IconName }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={String(o.v)} aria-pressed={value === o.v} onClick={() => { onChange(o.v); sfx('toggle'); }}>
          {o.icon && <Icon name={o.icon} size={18} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => { onChange(!checked); sfx('toggle'); }} />;
}

interface LanInfo {
  hostname: string;
  http: string[];
  https: string[];
  preferred: string;
  /** Numeric-address form of `preferred`, for a phone that cannot resolve the .local name. */
  fallback: string | null;
  /** Plain http on the name: no certificate warning, no microphone. */
  plain: string | null;
  /** https on the name: needed for the phone's microphone; one-time certificate warning. */
  secure: string | null;
  qr: string;
  tailscale?: { installed: boolean; online?: boolean; dnsName?: string; ip?: string; http?: string | null; serve?: string | null; qr?: string };
}

/** Reaching the app away from home: Tailscale keeps it private and gives a real https address. */
function AwayAccess({ ts }: { ts?: LanInfo['tailscale'] }) {
  return (
    <div className="card">
      <h3>خارج شبكة البيت</h3>
      {ts?.installed && ts.online ? (
        <>
          <div className="phone-access">
            {ts.qr && <div className="qr" dangerouslySetInnerHTML={{ __html: ts.qr }} role="img" aria-label={`رمز الاستجابة السريعة: ${ts.serve ?? ts.http}`} />}
            <div>
              <p>هذا الجهاز على شبكة Tailscale الخاصة بك. من أي مكان، على هاتف فيه Tailscale مسجّل بحسابك نفسه، وجّه الكاميرا إلى الرمز أو افتح:</p>
              <p className="mono" style={{ fontSize: '1rem', color: 'var(--ink)' }}>{ts.serve ?? ts.http}</p>
            </div>
          </div>
          {ts.serve ? (
            <p className="ref">عنوان https حقيقي: الميكروفون يعمل ولا تحذير من الشهادة.</p>
          ) : (
            <>
              <p className="ref">للحصول على عنوان https (يلزم للميكروفون على الهاتف) شغّل مرة واحدة في الطرفية على هذا الجهاز:</p>
              <pre className="mono" style={{ direction: 'ltr', textAlign: 'left', margin: '4px 0 8px', whiteSpace: 'pre-wrap' }}>tailscale serve --bg 7373</pre>
              <p className="ref">وفعّل HTTPS certificates و MagicDNS من لوحة Tailscale (DNS). بعدها يظهر العنوان هنا تلقائياً.</p>
            </>
          )}
        </>
      ) : (
        <>
          <p>الطريقة الآمنة للوصول من خارج البيت هي شبكة خاصة بينك وبين أجهزتك، لا فتح المنفذ على الإنترنت: التطبيق بلا كلمة سر ويحفظ تقدمك وتسجيلاتك.</p>
          <ol className="ref" style={{ paddingInlineStart: 20, margin: '4px 0 8px' }}>
            <li>ثبّت Tailscale على هذا الجهاز (من App Store أو tailscale.com) وعلى الهاتف، وسجّل الدخول بالحساب نفسه في الاثنين. مجاني للاستخدام الشخصي.</li>
            <li>على هذا الجهاز، في الطرفية: <span className="mono">tailscale serve --bg 7373</span></li>
            <li>افتح هذه الصفحة من جديد؛ يظهر عنوان https هنا يعمل من أي مكان، بميكروفون وبلا تحذير.</li>
          </ol>
          <p className="ref">{ts?.installed ? 'Tailscale مثبّت لكنه غير متصل الآن.' : 'لم يُعثر على Tailscale على هذا الجهاز.'}</p>
        </>
      )}
    </div>
  );
}

/** Addresses for a phone on the same Wi-Fi, answered by server/serve.mjs (absent under the dev server). */
function PhoneAccess() {
  const [info, setInfo] = useState<LanInfo | null | 'none'>(null);
  useEffect(() => {
    fetch('/__lan', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: LanInfo) => setInfo(j))
      .catch(() => setInfo('none'));
  }, []);
  if (info === 'none') return null;
  return (
    <div className="card">
      <h3>على هاتفك</h3>
      {info === null ? (
        <p className="ref">جارٍ القراءة…</p>
      ) : info.http.length === 0 ? (
        <p className="ref">هذا الجهاز غير متصل بشبكة محلية الآن.</p>
      ) : (
        <div className="phone-access">
          <div className="qr" dangerouslySetInnerHTML={{ __html: info.qr }} aria-label={`رمز الاستجابة السريعة: ${info.preferred}`} role="img" />
          <div>
            <p>افتح الكاميرا على الهاتف ووجّهها إلى الرمز، أو اكتب العنوان في المتصفح. يجب أن يكون الهاتف على شبكة Wi-Fi نفسها.</p>
            <p className="mono" style={{ fontSize: '1rem', color: 'var(--ink)' }}>{info.preferred}</p>
            <p className="ref">
              العنوان هو اسم هذا الجهاز على الشبكة ({info.hostname})، فلا يتغير مع تغيّر الشبكة.
              {info.fallback && (
                <>
                  {' '}إن لم يفتح على هاتفك، جرّب العنوان الرقمي: <span className="mono">{info.fallback}</span>
                </>
              )}
            </p>
            {info.secure && (
              <p className="ref">
                لتسجيل صوتك على الهاتف (الميكروفون) افتح العنوان المؤمّن بدلاً منه: <span className="mono">{info.secure}</span> — سيحذّرك المتصفح من الشهادة في المرة الأولى لأنها صادرة من هذا الجهاز، فاختر المتابعة.
              </p>
            )}
            <p className="ref">ثم من قائمة المشاركة اختر «إضافة إلى الشاشة الرئيسية» ليفتح كتطبيق.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'الآن' : m < 60 ? `قبل ${arNum(m)} ${m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : m <= 10 ? 'دقائق' : 'دقيقة'}` : `قبل ${arNum(Math.round(m / 60))} ساعة`;
}

/** Progress shared between devices through the local server (Settings → البيانات). */
function SyncRow() {
  const [st, setSt] = useState(syncStatus());
  useEffect(() => onSyncStatus(() => setSt(syncStatus())), []);
  const [busy, setBusy] = useState(false);
  return (
    <div className="setting">
      <span className="label">
        <Icon name="refresh" />
        <span>
          المزامنة بين أجهزتك
          <small>
            {st.available === false
              ? 'غير متاحة هنا (تعمل عند فتح التطبيق عبر الخادم المحلي على الجهاز أو الهاتف).'
              : st.lastSync
                ? `تقدمك وإعداداتك مشتركة بين كل جهاز يفتح التطبيق من هذا الجهاز. آخر مزامنة: ${ago(st.lastSync)}.`
                : 'جارٍ الاتصال…'}
          </small>
        </span>
      </span>
      <button className="toggle" disabled={busy || st.available === false} onClick={async () => { setBusy(true); await syncNow(); setBusy(false); sfx('toggle'); }}>
        <Icon name="refresh" size={18} /> زامن الآن
      </button>
    </div>
  );
}

/** Wrapper that reads /__lan once for the away-from-home card. */
function AwayAccessFromLan() {
  const [ts, setTs] = useState<LanInfo['tailscale'] | null | 'none'>(null);
  useEffect(() => {
    fetch('/__lan', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: LanInfo) => setTs(j.tailscale ?? { installed: false }))
      .catch(() => setTs('none'));
  }, []);
  if (ts === 'none' || ts === null) return null;
  return <AwayAccess ts={ts} />;
}

export function SettingsPage({ go }: { go: (hash: string) => void }) {
  const [s, update] = useSettings();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update({ [k]: v } as Partial<Settings>);
  return (
    <div className="page lessons stagger grid2">
      <div className="card intro">
        <h2>الإعدادات</h2>
        <p className="ref">كل شيء يُحفظ على هذا الجهاز فقط.</p>
      </div>

      <div className="card">
        <h3>المظهر</h3>
        <div className="setting">
          <span className="label"><Icon name="sun" /> السمة</span>
          <Segment<Theme> value={s.theme} onChange={(v) => set('theme', v)} options={[{ v: 'system', label: 'النظام', icon: 'monitor' }, { v: 'light', label: 'فاتح', icon: 'sun' }, { v: 'dark', label: 'داكن', icon: 'moon' }]} />
        </div>
        <div className="setting">
          <span className="label">
            <Icon name="textSize" />
            <span>
              حجم نص القرآن
              <small>يؤثر في الآيات والكلمات فقط</small>
            </span>
          </span>
          <Segment<Settings['quranScale']> value={s.quranScale} onChange={(v) => set('quranScale', v)} options={[{ v: 1, label: 'عادي' }, { v: 1.15, label: 'كبير' }, { v: 1.3, label: 'أكبر' }]} />
        </div>
        <div className="ayah" dir="rtl" style={{ textAlign: 'center' }}>بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ</div>
        <div className="setting">
          <span className="label">
            <Icon name="motion" />
            <span>
              الحركة
              <small>«أقل» يوقف حركات الواجهة، لا حركة الفم في العارض</small>
            </span>
          </span>
          <Segment<Motion> value={s.motion} onChange={(v) => set('motion', v)} options={[{ v: 'system', label: 'النظام' }, { v: 'reduced', label: 'أقل' }]} />
        </div>
      </div>

      <div className="card">
        <h3>الأصوات</h3>
        <div className="setting">
          <span className="label">
            <Icon name={s.sound ? 'volume' : 'volumeOff'} />
            <span>
              أصوات الواجهة
              <small>نغمة قصيرة عند الإجابة والإنجاز؛ لا علاقة لها بصوت القارئ</small>
            </span>
          </span>
          <Switch checked={s.sound} onChange={(v) => set('sound', v)} label="أصوات الواجهة" />
        </div>
        <div className="setting">
          <span className="label">
            <Icon name="vibrate" />
            <span>
              الاهتزاز
              <small>على الهواتف التي تدعمه</small>
            </span>
          </span>
          <Switch checked={s.haptics} onChange={(v) => set('haptics', v)} label="الاهتزاز" />
        </div>
      </div>

      <div className="card">
        <h3>الهدف اليومي</h3>
        <div className="setting">
          <span className="label">
            <Icon name="target" />
            <span>
              نقاط في اليوم
              <small>الدرس = ٣ نقاط، التدريب = نقطتان، كل إجابة = نقطة</small>
            </span>
          </span>
          <Segment<number> value={s.dailyGoal} onChange={(v) => set('dailyGoal', v)} options={[{ v: 5, label: arNum(5) }, { v: 10, label: arNum(10) }, { v: 20, label: arNum(20) }]} />
        </div>
      </div>

      <PhoneAccess />
      <AwayAccessFromLan />

      <div className="card">
        <h3>البيانات</h3>
        <SyncRow />
        <div className="setting">
          <span className="label">
            <Icon name="trash" />
            <span>
              إعادة ضبط التقدم
              <small>يمسح الدروس المنجزة والسلسلة والهدف اليومي. تسجيلاتك ومحاذاتك تبقى.</small>
            </span>
          </span>
          <button className="danger" onClick={() => { if (confirm('تُمسح الدروس المنجزة والسلسلة اليومية. هل تريد المتابعة؟')) { resetProgress(); sfx('toggle'); go('#/'); } }}>
            إعادة الضبط
          </button>
        </div>
      </div>

      <div className="card soft">
        <h3>عن نُطق</h3>
        <p className="ref">تعلّم نطق القرآن برواية الدوري عن أبي عمرو. النص من المصحف، والصوت من القارئ، ولا يُقيّم التطبيق قراءتك؛ هو يُريك ويُسمعك وتقارن أنت.</p>
        <p className="ref">
          أدوات المطوّر:{' '}
          <a href="#/align/1" onClick={(e) => { e.preventDefault(); go('#/align/1'); }}>المحاذاة</a> ·{' '}
          <a href="#/recorder" onClick={(e) => { e.preventDefault(); go('#/recorder'); }}>تسجيل المعلم</a> ·{' '}
          <a href="#/checklist" onClick={(e) => { e.preventDefault(); go('#/checklist'); }}>الجاهزية</a>
        </p>
      </div>
    </div>
  );
}
