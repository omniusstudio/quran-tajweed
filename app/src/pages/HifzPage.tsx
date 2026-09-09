import { useEffect, useState } from 'react';
import { SURAH_BY_NUMBER } from '../audio/quran';
import { challenges, currentChallenge, dueReviews, hifzState, markMemorized, recordReview, versesMemorized, type Challenge } from '../content/hifz';
import { logActivity, readProgress } from '../content/progress';
import { celebrate } from '../ui/celebrate';
import { Icon } from '../ui/icons';
import { sfx } from '../ui/sound';
import { useSettings } from '../ui/settings';
import { VerseDrill } from './VerseDrill';
import { arNum } from './shared';

function useHifz() {
  const [, force] = useState(0);
  useEffect(() => {
    const on = () => force((n) => n + 1);
    addEventListener('nutq:progress', on);
    return () => removeEventListener('nutq:progress', on);
  }, []);
  return hifzState(readProgress());
}

const STEPS = ['اسمع', 'ردّد', 'اقرأ من حفظك', 'قارن', 'احكم'];

/** The daily memorization challenge (#/hifz): five whole verses, in the khalwa's order. */
export function HifzPage({ go }: { go: (hash: string) => void }) {
  const h = useHifz();
  const [settings] = useSettings();
  const current = currentChallenge(h);
  const reviews = dueReviews(h);
  const total = challenges().length;
  const doneCount = Object.keys(h.done).length;
  const [step, setStep] = useState(0);
  const [reviewing, setReviewing] = useState<Challenge | null>(null);
  const active = reviewing ?? current;
  useEffect(() => setStep(0), [active?.id]);

  const title = (c: Challenge) => `${c.surahName}، ${c.verses.length === 1 ? `الآية ${arNum(c.verses[0])}` : `الآيات ${arNum(c.verses[0])}–${arNum(c.verses[c.verses.length - 1])}`}`;

  const finish = (c: Challenge) => {
    markMemorized(c.id);
    logActivity('challenge');
    sfx('fanfare');
    celebrate({ kind: 'section', title: 'حفظتها', text: `${arNum(versesMemorized(hifzState()))} آية في صدرك حتى الآن. التحدي التالي جاهز متى شئت.` });
  };

  return (
    <div className="page hifz">
      <header className="page-head">
        <span className="eyebrow">تحدي الحفظ اليومي</span>
        <h2 className="page-title">{active ? title(active) : 'أتممت المسار'}</h2>
        <p className="ref">خمس آيات كاملة كل يوم بترتيب الخلوة: الفاتحة ثم من الناس صعوداً. التطبيق يُسمعك ويسجّل ويقارن، وأنت من يحكم.</p>
      </header>

      <div className="hifz-stats">
        <span className="stat"><Icon name="book" size={18} /> {arNum(versesMemorized(h))} آية محفوظة</span>
        <span className="stat"><Icon name="flame" size={18} /> {arNum(doneCount)} / {arNum(total)} تحدياً</span>
        {reviews.length > 0 && <span className="stat on"><Icon name="clock" size={18} /> {arNum(reviews.length)} للمراجعة</span>}
      </div>

      {active && (
        <section className="card challenge">
          <ol className="stepper" aria-label="خطوات التحدي">
            {STEPS.map((label, i) => (
              <li key={label} className={i === step ? 'now' : i < step ? 'done' : ''}>
                <button onClick={() => setStep(i)}>
                  <span className="n">{i < step ? <Icon name="check" size={14} /> : arNum(i + 1)}</span>
                  {label}
                </button>
              </li>
            ))}
          </ol>
          <p className="step-hint">
            {step === 0 && 'اسمع الآيات مرتين أو ثلاثاً وعينك على النص.'}
            {step === 1 && 'ردّد: تُسمع آية، ثم صفارة، فتقرؤها أنت، ثم التي بعدها.'}
            {step === 2 && 'أخفِ النص وسجّل نفسك وأنت تقرأ من حفظك.'}
            {step === 3 && 'اسمع القارئ ثم نفسك، آية آية. أين الفرق؟'}
            {step === 4 && (reviewing ? 'هل ما زلت تحفظها؟' : 'هل حفظتها حفظاً تطمئن إليه؟')}
          </p>
          <VerseDrill key={active.id} surah={active.surah} verses={active.verses} reciter={settings.reciter} hideByDefault={step >= 2} clipKey={`me/hifz/${active.id}`} onRecorded={() => setStep((s) => Math.max(s, 3))} />
          {active.opensSurah && SURAH_BY_NUMBER[active.surah].header && <p className="ref">تبدأ هذه السورة بالبسملة؛ اقرأها قبل الآية الأولى.</p>}
          <div className="row wrap" style={{ marginBlockStart: 12, justifyContent: 'space-between' }}>
            <button className="toggle" onClick={() => go(`#/follow/${active.surah}`)}><Icon name="headphones" size={18} /> السورة كاملة في المتابعة</button>
            {step < 4 ? (
              <button className="primary" onClick={() => { sfx('tap'); setStep((s) => s + 1); }}>
                الخطوة التالية <Icon name="chevronLeft" size={18} />
              </button>
            ) : reviewing ? (
              <span className="row">
                <button className="toggle" onClick={() => { recordReview(reviewing.id, false); sfx('wrong'); setReviewing(null); }}>نسيتها، أعدها غداً</button>
                <button className="primary" onClick={() => { recordReview(reviewing.id, true); sfx('correct'); setReviewing(null); }}><Icon name="check" size={18} /> ما زلت أحفظها</button>
              </span>
            ) : (
              <span className="row">
                <button className="toggle" onClick={() => { sfx('toggle'); setStep(0); }}>أحتاج تكراراً</button>
                <button className="primary" onClick={() => finish(active)}><Icon name="check" size={18} /> حفظتها</button>
              </span>
            )}
          </div>
        </section>
      )}

      {reviews.length > 0 && !reviewing && (
        <section className="card">
          <h3>مراجعة اليوم</h3>
          <p className="ref">ما حفظته يعود إليك بعد يوم، ثم ثلاثة، ثم أسبوع، ثم شهر. اقرأه من حفظك ثم قل إن كان ما زال معك.</p>
          <div className="review-list">
            {reviews.map((c) => (
              <button key={c.id} className="review-item" onClick={() => { setReviewing(c); setStep(2); scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <span>{title(c)}</span>
                <span className="ref">{arNum(h.done[c.id].reviews)} مراجعات ناجحة</span>
                <Icon name="chevronLeft" size={18} />
              </button>
            ))}
          </div>
        </section>
      )}

      {reviewing && (
        <p className="ref">
          <button className="mini" onClick={() => setReviewing(null)}><Icon name="chevronRight" size={14} /> عودة إلى تحدي اليوم</button>
        </p>
      )}

      <section className="card soft">
        <h3>المسار</h3>
        <div className="path">
          {challenges().slice(Math.max(0, (active?.index ?? 1) - 3), (active?.index ?? 1) + 5).map((c) => (
            <span key={c.id} className={`path-item${h.done[c.id] ? ' done' : ''}${c.id === active?.id ? ' now' : ''}`}>
              <span className="n">{h.done[c.id] ? <Icon name="check" size={14} /> : arNum(c.index)}</span>
              <span>{c.surahName} {arNum(c.verses[0])}{c.verses.length > 1 ? `–${arNum(c.verses[c.verses.length - 1])}` : ''}</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
