import { useEffect } from 'react';
import { RULE_VIEWER } from '../content/ruleViewer';
import { DICTIONARY_RULES } from '../content/terms';
import { SECTIONS } from '../content/lessons';
import { Ayah, LetterViewer, LinkedText } from './shared';

/** The plain dictionary (section 2): every term with its one-paragraph definition and an example. */
export function DictionaryPage({ termId, go }: { termId?: string; go: (hash: string) => void }) {
  useEffect(() => {
    if (!termId) return;
    document.getElementById(termId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [termId]);
  const section = SECTIONS[1];
  return (
    <div className="page lessons stagger">
      <div className="card">
        <h2>{section.title}</h2>
        {section.intro && <p className="ref">{section.intro}</p>}
        <div className="chips">
          {DICTIONARY_RULES.map((r) => (
            <button key={r.id} className="chip small" aria-pressed={r.id === termId} onClick={() => go(`#/dictionary/${r.id}`)}>
              {r.name}
            </button>
          ))}
        </div>
      </div>
      {DICTIONARY_RULES.map((r) => {
        const v = RULE_VIEWER[r.id];
        return (
          <div className={`card entry${r.id === termId ? ' active' : ''}`} key={r.id} id={r.id}>
            <h3>{r.name}</h3>
            <LinkedText text={r.text} skipRuleId={r.id} onTerm={(id) => go(`#/dictionary/${id}`)} />
            {r.examples.length > 0 && (
              <div className="examples">
                {r.examples.map((ex, i) => (
                  <Ayah key={i} ex={ex} />
                ))}
              </div>
            )}
            {r.id === termId && v?.letters && <LetterViewer id={v.letters[0]} />}
          </div>
        );
      })}
    </div>
  );
}
