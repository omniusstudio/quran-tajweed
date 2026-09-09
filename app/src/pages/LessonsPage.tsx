import { useEffect, useState } from 'react';
import { RULES, SECTIONS, type Rule } from '../content/lessons';
import { useProgress } from '../content/progress';
import { RULE_VIEWER } from '../content/ruleViewer';
import { BY_ID, CONTRAST_PAIRS } from '../viewer/articulations';
import { ContrastView } from '../viewer/ContrastView';
import { Ayah, Figures, LetterViewer, LinkedText, arNum } from './shared';
import { RULES as TAG_RULES, tagVerse, type RuleId } from '../rules/tagger';
import { LESSON_EXERCISE } from '../content/ruleViewer';
import { Icon } from '../ui/icons';
import { rewardLesson } from '../ui/rewards';
import { sfx } from '../ui/sound';

const ORDER: string[] = SECTIONS.flatMap((s) => s.rules.map((r) => r.id));

export function sectionOf(ruleId: string) {
  return SECTIONS.find((s) => s.rules.some((r) => r.id === ruleId))!;
}

/** Overview: every section with its rules and progress. */
export function LessonsIndex({ go }: { go: (hash: string) => void }) {
  const [progress] = useProgress();
  const total = ORDER.length;
  const done = ORDER.filter((id) => progress.done[id]).length;
  const next = progress.last && ORDER.includes(progress.last) ? progress.last : ORDER[0];
  return (
    <div className="page lessons stagger grid2">
      <div className="card hero">
        <div style={{ flex: '1 1 240px' }}>
          <h2>الدروس</h2>
          <p className="ref">أتممت {arNum(done)} من {arNum(total)} خطوة.</p>
          <span className="bar" aria-hidden><i style={{ transform: `scaleX(${total ? done / total : 0})` }} /></span>
        </div>
        <button className="primary" onClick={() => go(`#/lessons/${next}`)}>
          <Icon name="play" size={18} />
          {progress.last ? 'أكمل من حيث توقفت' : 'ابدأ من البداية'}
        </button>
      </div>
      {SECTIONS.map((s) => {
        const d = s.rules.filter((r) => progress.done[r.id]).length;
        return (
          <div className="card" key={s.id}>
            <div className="section-head">
              <h3>{s.title}</h3>
              <span className="badge">{arNum(d)} / {arNum(s.rules.length)}</span>
            </div>
            {s.intro && <p className="ref">{s.intro}</p>}
            <ol className="rule-list">
              {s.rules.map((r) => (
                <li key={r.id}>
                  <a href={`#/lessons/${r.id}`} onClick={(e) => { e.preventDefault(); go(`#/lessons/${r.id}`); }} className={progress.done[r.id] ? 'done' : ''}>
                    <span className="tick" aria-hidden>{progress.done[r.id] ? <Icon name="check" size={14} /> : null}</span>
                    {r.name}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

/** What the tagger finds on the highlighted words of an example (sections 6–13 only). */
function ExampleTags({ ex }: { ex: Rule['examples'][number] }) {
  const tags = tagVerse({ words: ex.words, hafs: ex.hafs, nextWord: ex.nextWord }).filter((t) => ex.hit.includes(t.word) && t.rule !== 'waqf_end' && t.rule !== 'madd_tabii');
  if (!tags.length) return null;
  const seen = new Set<string>();
  return (
    <div className="tagline">
      {tags
        .filter((t) => {
          const k = `${t.word}:${t.rule}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .map((t, i) => (
          <span key={i} className={`tag ${TAG_RULES[t.rule as RuleId].group}`} title={ex.words[t.word]}>
            {ex.words[t.word]}: {TAG_RULES[t.rule as RuleId].label}
          </span>
        ))}
    </div>
  );
}

/** One rule = one screen: text → figures/animation → examples → try it. */
export function LessonScreen({ ruleId, go }: { ruleId: string; go: (hash: string) => void }) {
  const rule: Rule | undefined = RULES[ruleId];
  const [progress, mark, visit] = useProgress();
  const idx = ORDER.indexOf(ruleId);
  const prev = idx > 0 ? ORDER[idx - 1] : null;
  const next = idx >= 0 && idx < ORDER.length - 1 ? ORDER[idx + 1] : null;
  const viewer = RULE_VIEWER[ruleId];
  const [letter, setLetter] = useState(viewer?.letters?.[0]);
  useEffect(() => {
    setLetter(RULE_VIEWER[ruleId]?.letters?.[0]);
    visit(ruleId);
    scrollTo({ top: 0 });
  }, [ruleId, visit]);
  if (!rule) return <p>لم يُعثر على هذا الدرس.</p>;
  const section = sectionOf(ruleId);
  const pos = section.rules.findIndex((r) => r.id === ruleId) + 1;
  const pair = viewer?.contrast ? CONTRAST_PAIRS.find((p) => p.id === viewer.contrast) : undefined;
  const isDone = !!progress.done[ruleId];
  /** Mark done once: log it, cue it, celebrate a finished section or the daily goal. */
  const complete = () => {
    if (progress.done[ruleId]) return;
    mark(ruleId, true);
    rewardLesson(ruleId, { ...progress.done, [ruleId]: true });
  };

  return (
    <div className="page lesson">
      <div className="lesson-head">
        <a href="#/lessons" onClick={(e) => { e.preventDefault(); go('#/lessons'); }} className="crumb">
          <Icon name="chevronRight" size={18} />
          {section.title}
        </a>
        <span className="row">
          <span className="step-dots" aria-hidden>
            {section.rules.map((r, i) => (
              <i key={r.id} className={r.id === ruleId ? 'now' : progress.done[r.id] ? 'done' : ''} style={{ order: i }} />
            ))}
          </span>
          <span className="ref">الخطوة {arNum(pos)} من {arNum(section.rules.length)}</span>
        </span>
      </div>
      <h2>{rule.name}</h2>
      <div className="card">
        <LinkedText text={rule.text} skipRuleId={ruleId} onTerm={(id) => go(`#/dictionary/${id}`)} />
        {ruleId.startsWith('s2') && rule.examples.length > 0 && <p className="ref">مثال من المصحف:</p>}
        {rule.examples.length > 0 && (
          <div className="examples">
            {rule.examples.map((ex, i) => (
              <div key={i}>
                <Ayah ex={ex} />
                <ExampleTags ex={ex} />
              </div>
            ))}
          </div>
        )}
      </div>

      {rule.figures.length > 0 && (
        <div className="card">
          <h3>انظر</h3>
          <Figures figures={rule.figures} />
        </div>
      )}

      {viewer && (viewer.letters || pair) && (
        <div className="card">
          <h3>شاهد حركة الفم ثم قلّد</h3>
          <p className="ref">{SECTIONS[2].intro}</p>
          {viewer.letters && (
            <div className="chips" style={{ marginBlockEnd: 8 }}>
              {viewer.letters.map((id) => (
                <button key={id} className={`chip${BY_ID[id].letters.length > 3 ? ' small' : ''}`} aria-pressed={letter === id} onClick={() => setLetter(id)} title={BY_ID[id].nameAr}>
                  {BY_ID[id].wrong ? `${BY_ID[id].letters} ✗` : BY_ID[id].letters}
                </button>
              ))}
            </div>
          )}
          {viewer.letters && letter && <LetterViewer id={letter} />}
          {pair && (
            <div style={{ marginBlockStart: 12 }}>
              <h3>هذا، لا ذاك: {pair.title}</h3>
              <ContrastView key={pair.id} pair={pair} />
            </div>
          )}
        </div>
      )}

      {LESSON_EXERCISE[ruleId] && (
        <div className="card">
          <h3>تمرين</h3>
          <div className="row wrap">
            {LESSON_EXERCISE[ruleId].map((ex) => (
              <button key={ex.hash} className="primary" onClick={() => go(ex.hash)}>
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card try">
        <h3>جرّب</h3>
        <p>اقرأ القاعدة مرة أخرى، ثم انطق المثال بصوت مسموع ثلاث مرات ببطء. حين تشعر أنك فهمت الفكرة اضغط «أتممت».</p>
        <label className="check">
          <input type="checkbox" checked={isDone} onChange={(e) => (e.target.checked ? complete() : (mark(ruleId, false), sfx('toggle')))} /> أتممت هذه الخطوة
        </label>
      </div>

      <nav className="lesson-nav">
        <button disabled={!prev} onClick={() => { sfx('tap'); prev && go(`#/lessons/${prev}`); }}>
          <Icon name="chevronRight" size={18} />
          السابق
        </button>
        <button className="primary" disabled={!next && isDone} onClick={() => { complete(); next && go(`#/lessons/${next}`); }}>
          {next ? 'أتممت، التالي' : 'أتممت الدروس'}
          <Icon name="chevronLeft" size={18} />
        </button>
      </nav>
    </div>
  );
}
