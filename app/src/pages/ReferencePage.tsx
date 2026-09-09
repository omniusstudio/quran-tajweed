import { useEffect } from 'react';
import { REF_SECTIONS } from '../content/duriRef';
import type { Example } from '../content/lessons';
import { tagVerse, RULES as TAG_RULES } from '../rules/tagger';
import { Ayah, LinkedText, arNum } from './shared';

/** A verse example with the Ḥafṣ form of each target word beside the Dūrī one. */
function DuriVsHafs({ ex }: { ex: Example }) {
  const tags = tagVerse({ words: ex.words, hafs: ex.hafs, nextWord: ex.nextWord }).filter((t) => ex.hit.includes(t.word) && t.rule !== 'waqf_end' && t.rule !== 'madd_tabii');
  const rows = ex.hit.map((i) => ({ duri: ex.words[i], hafs: ex.hafs[i], tags: tags.filter((t) => t.word === i).map((t) => TAG_RULES[t.rule].label) }));
  const differs = rows.some((r) => r.hafs && r.hafs !== r.duri);
  return (
    <div className="ref-example">
      <Ayah ex={ex} />
      {differs && (
        <table className="cmp">
          <thead>
            <tr>
              <th>الدوري</th>
              <th>حفص</th>
              <th>القاعدة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="q">{r.duri}</td>
                <td className="q hafs">{r.hafs ?? '—'}</td>
                <td>{Array.from(new Set(r.tags)).join('، ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Dūrī vs Ḥafṣ reference screens from content_duri.py (PROMPT.md §4). */
export function ReferencePage({ sectionId, go }: { sectionId?: string; go: (hash: string) => void }) {
  const section = REF_SECTIONS.find((s) => s.id === sectionId) ?? REF_SECTIONS[0];
  useEffect(() => scrollTo({ top: 0 }), [section.id]);
  return (
    <div className="lessons">
      <div className="card">
        <h2>المرجع: الدوري وحفص</h2>
        <p className="ref">البيان الكامل لما يختلف فيه الدوري عن حفص (أصول وفرش)، وكل الأمثلة من مصحف الدوري نفسه.</p>
        <div className="chips">
          {REF_SECTIONS.map((s) => (
            <button key={s.id} className="chip small" aria-pressed={s.id === section.id} onClick={() => go(`#/reference/${s.id}`)}>
              {s.title}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>{section.title}</h2>
        {section.intro && <p className="ref">{section.intro}</p>}
      </div>
      {section.rules.map((r) => (
        <div className="card" key={r.id} id={r.id}>
          <h3>{r.name}</h3>
          <LinkedText text={r.text} onTerm={(id) => go(`#/dictionary/${id}`)} />
          {r.examples.length > 0 && (
            <div className="examples">
              {r.examples.map((ex, i) => (
                <DuriVsHafs key={i} ex={ex} />
              ))}
            </div>
          )}
        </div>
      ))}
      <nav className="lesson-nav">
        {(() => {
          const i = REF_SECTIONS.indexOf(section);
          const prev = REF_SECTIONS[i - 1];
          const next = REF_SECTIONS[i + 1];
          return (
            <>
              <button disabled={!prev} onClick={() => prev && go(`#/reference/${prev.id}`)}>→ {prev ? prev.title.slice(0, 24) : 'السابق'}</button>
              <button className="primary" disabled={!next} onClick={() => next && go(`#/reference/${next.id}`)}>{next ? `${next.title.slice(0, 24)} ←` : `الفصل ${arNum(i + 1)} من ${arNum(REF_SECTIONS.length)}`}</button>
            </>
          );
        })()}
      </nav>
    </div>
  );
}
