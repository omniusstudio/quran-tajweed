import { useEffect, useState } from 'react';
import { RULES, type Example, type Rule } from './content/lessons';
import { refImage } from './content/refImages';
import { ARTICULATIONS, BY_ID, CONTRAST_PAIRS, GROUPS } from './viewer/articulations';
import { ArticulationViewer } from './viewer/ArticulationViewer';
import { ContrastView } from './viewer/ContrastView';
import { Controls } from './viewer/Controls';
import { useClock } from './viewer/useClock';

type Route = { tab: 'letters'; id: string } | { tab: 'contrast'; id: string } | { tab: 'checklist' };

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [tab, id] = h.split('/');
  if (tab === 'contrast') return { tab: 'contrast', id: id && CONTRAST_PAIRS.some((p) => p.id === id) ? id : CONTRAST_PAIRS[0].id };
  if (tab === 'checklist') return { tab: 'checklist' };
  return { tab: 'letters', id: id && BY_ID[id] ? id : 'qaf' };
}

function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const go = (r: Route) => {
    location.hash = r.tab === 'checklist' ? '#/checklist' : `#/${r.tab}/${r.id}`;
  };
  return [route, go];
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const arNum = (n: number | null) => (n == null ? '—' : String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]));

function Ayah({ ex }: { ex: Example }) {
  return (
    <div>
      <div className="ayah" dir="rtl">
        {ex.words.map((w, i) => (
          <span key={i}>
            {ex.hit.includes(i) ? <span className="hl">{w}</span> : w}{' '}
          </span>
        ))}
      </div>
      <div className="ref">
        {ex.surahName}، الآية {arNum(ex.basri)} (حفص: {arNum(ex.kufi)})
      </div>
    </div>
  );
}

function RuleInfo({ rule, needsReview }: { rule: Rule; needsReview?: string }) {
  return (
    <aside className="info">
      <h2>{rule.name}</h2>
      <p>{rule.text}</p>
      {needsReview && <p className="todo">⚠ يُراجع: {needsReview}</p>}
      {rule.figures.length > 0 && (
        <div className="figs">
          {rule.figures.map((f, i) => (
            <figure key={i} className="fig" style={{ margin: 0 }}>
              {f.img && refImage(f.img) && <img src={refImage(f.img)} alt={f.caption} loading="lazy" />}
              <figcaption>{f.caption}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {rule.examples.length > 0 && (
        <div className="examples">
          {rule.examples.slice(0, 3).map((ex, i) => (
            <Ayah key={i} ex={ex} />
          ))}
        </div>
      )}
    </aside>
  );
}

function LettersPage({ id, go }: { id: string; go: (r: Route) => void }) {
  const art = BY_ID[id];
  const clock = useClock(art.duration);
  useEffect(() => clock.restart(), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const rule = art.ruleId ? RULES[art.ruleId] : undefined;
  return (
    <>
      <div className="viewer-layout">
        <div>
          <ArticulationViewer art={art} t={clock.t} />
          <Controls clock={clock} />
        </div>
        {rule && <RuleInfo rule={rule} needsReview={art.needsReview} />}
      </div>
      <div className="groups" style={{ marginBlockStart: 12 }}>
        {GROUPS.map((g) => (
          <div className="group" key={g.id}>
            <h3>{g.title}</h3>
            <div className="chips">
              {ARTICULATIONS.filter((a) => a.group === g.id).map((a) => (
                <button
                  key={a.id}
                  className={`chip${a.letters.length > 3 ? ' small' : ''}${a.keyframes.some((k) => k.heavy) ? ' heavy' : ''}`}
                  aria-pressed={a.id === id}
                  onClick={() => {
                    go({ tab: 'letters', id: a.id });
                    scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  title={a.nameAr}
                >
                  {a.wrong ? `${a.letters} ✗` : a.letters}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ContrastPage({ id, go }: { id: string; go: (r: Route) => void }) {
  const pair = CONTRAST_PAIRS.find((p) => p.id === id) ?? CONTRAST_PAIRS[0];
  return (
    <>
      <div className="group">
        <h3>هذا، لا ذاك</h3>
        <div className="chips">
          {CONTRAST_PAIRS.map((p) => (
            <button key={p.id} className="chip small" aria-pressed={p.id === pair.id} onClick={() => go({ tab: 'contrast', id: p.id })}>
              {p.title}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBlockStart: 12 }}>
        <ContrastView key={pair.id} pair={pair} />
      </div>
    </>
  );
}

function ChecklistPage() {
  const ok = '✅';
  const no = '❌';
  return (
    <div className="checklist">
      <p className="ref">قائمة الجاهزية (مسار المطوّر): حركة، صوت المعلم، مثال، تمرين.</p>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>الحرف</th>
              <th>الاسم</th>
              <th>الحركة</th>
              <th>صوت المعلم</th>
              <th>مثال</th>
              <th>تمرين</th>
              <th>ملاحظة</th>
            </tr>
          </thead>
          <tbody>
            {ARTICULATIONS.map((a) => {
              const rule = a.ruleId ? RULES[a.ruleId] : undefined;
              return (
                <tr key={a.id}>
                  <td className="q">{a.letters}</td>
                  <td>{a.nameAr}</td>
                  <td>{ok}</td>
                  <td>{no}</td>
                  <td>{rule && rule.examples.length > 0 ? ok : no}</td>
                  <td>{no}</td>
                  <td>{a.needsReview ? `يُراجع: ${a.needsReview}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function App() {
  const [route, go] = useRoute();
  return (
    <div className="app">
      <header className="app-header">
        <h1>نُطق</h1>
        <span className="sub">عارض المخارج — رواية الدوري عن أبي عمرو (المرحلة الأولى)</span>
      </header>
      <nav className="tabs">
        <button aria-pressed={route.tab === 'letters'} onClick={() => go({ tab: 'letters', id: route.tab === 'letters' ? route.id : 'qaf' })}>
          الحروف
        </button>
        <button aria-pressed={route.tab === 'contrast'} onClick={() => go({ tab: 'contrast', id: route.tab === 'contrast' ? route.id : CONTRAST_PAIRS[0].id })}>
          هذا، لا ذاك
        </button>
        <button aria-pressed={route.tab === 'checklist'} onClick={() => go({ tab: 'checklist' })}>
          قائمة الجاهزية
        </button>
      </nav>
      {route.tab === 'letters' && <LettersPage id={route.id} go={go} />}
      {route.tab === 'contrast' && <ContrastPage id={route.id} go={go} />}
      {route.tab === 'checklist' && <ChecklistPage />}
    </div>
  );
}
