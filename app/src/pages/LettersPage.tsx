import { useEffect } from 'react';
import { RULES } from '../content/lessons';
import { ARTICULATIONS, BY_ID, CONTRAST_PAIRS, GROUPS } from '../viewer/articulations';
import { ArticulationViewer } from '../viewer/ArticulationViewer';
import { ContrastView } from '../viewer/ContrastView';
import { Controls } from '../viewer/Controls';
import { useClock } from '../viewer/useClock';
import { Ayah, Figures, LinkedText } from './shared';
import { LESSON_EXERCISE } from '../content/ruleViewer';

export function LettersPage({ id, go }: { id: string; go: (hash: string) => void }) {
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
        {rule && (
          <aside className="info">
            <h2>{rule.name}</h2>
            <LinkedText text={rule.text} onTerm={(tid) => go(`#/dictionary/${tid}`)} />
            {art.needsReview && <p className="todo">⚠ يُراجع: {art.needsReview}</p>}
            <Figures figures={rule.figures} />
            {rule.examples.length > 0 && (
              <div className="examples">
                {rule.examples.slice(0, 3).map((ex, i) => (
                  <Ayah key={i} ex={ex} />
                ))}
              </div>
            )}
            <p className="ref" style={{ marginBlockStart: 8 }}>
              <a href={`#/lessons/${rule.id}`} onClick={(e) => { e.preventDefault(); go(`#/lessons/${rule.id}`); }}>
                افتح هذا الدرس ←
              </a>
            </p>
          </aside>
        )}
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
                    go(`#/letters/${a.id}`);
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

export function ContrastPage({ id, go }: { id: string; go: (hash: string) => void }) {
  const pair = CONTRAST_PAIRS.find((p) => p.id === id) ?? CONTRAST_PAIRS[0];
  return (
    <>
      <div className="group">
        <h3>هذا، لا ذاك</h3>
        <div className="chips">
          {CONTRAST_PAIRS.map((p) => (
            <button key={p.id} className="chip small" aria-pressed={p.id === pair.id} onClick={() => go(`#/contrast/${p.id}`)}>
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

export function ChecklistPage() {
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
                  <td>{a.ruleId && LESSON_EXERCISE[a.ruleId] ? ok : ['sin', 'sad', 'ta', 'tta', 'kaf', 'qaf', 'dhal', 'zha', 'dal', 'dad', 'jim', 'shin', 'hamza', 'ain', 'ha', 'hha', 'zay'].includes(a.id) ? ok : no}</td>
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
