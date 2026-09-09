import { useEffect, useState } from 'react';
import { resetProgress } from '../content/progress';
import { Icon, type IconName } from '../ui/icons';
import { useSettings, type Settings, type Theme, type Motion } from '../ui/settings';
import { sfx } from '../ui/sound';
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
  qr: string;
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
            {info.https.length > 0 && (
              <p className="ref">
                العنوان المؤمّن (https) يسمح بالميكروفون على الهاتف؛ سيحذّرك المتصفح من الشهادة في المرة الأولى لأنها صادرة من هذا الجهاز، فاختر المتابعة. البديل بلا تحذير ولا ميكروفون: <span className="mono">{info.http[0]}</span>
              </p>
            )}
            <p className="ref">ثم من قائمة المشاركة اختر «إضافة إلى الشاشة الرئيسية» ليفتح كتطبيق.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsPage({ go }: { go: (hash: string) => void }) {
  const [s, update] = useSettings();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update({ [k]: v } as Partial<Settings>);
  return (
    <div className="page lessons stagger">
      <div className="card">
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

      <div className="card">
        <h3>البيانات</h3>
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
