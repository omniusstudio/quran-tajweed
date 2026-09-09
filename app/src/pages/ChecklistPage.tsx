import { useEffect, useState } from 'react';
import { listKeys } from '../audio/store';
import { DRILLS } from '../content/drills';
import { RULES as LESSON_RULES } from '../content/lessons';
import { LESSON_EXERCISE } from '../content/ruleViewer';
import { spotRulesAvailable, taggedVerses } from '../exercises/bank';
import { RULES as TAG_RULES, type RuleId } from '../rules/tagger';
import { ARTICULATIONS, CONTRAST_PAIRS } from '../viewer/articulations';
import { arNum } from './shared';

const OK = '✅';
const NO = '❌';

/**
 * Release checklist (PROMPT.md §9): every letter, every rule, every Dūrī feature with ✅/❌ for
 * animation, teacher audio (live, from the clips stored in this browser), example, exercise.
 */
export function ChecklistPage() {
  const [teacher, setTeacher] = useState<Set<string> | null>(null);
  useEffect(() => {
    void listKeys('teacher/').then((k) => setTeacher(new Set(k.map((x) => x.slice('teacher/'.length)))));
  }, []);
  const has = (id: string) => !!teacher?.has(id);
  const exerciseRules = new Set<RuleId>(spotRulesAvailable());
  const inText = new Set<RuleId>();
  for (const t of taggedVerses()) for (const x of t.tags) inText.add(x.rule);
  const listenPairs = new Set(CONTRAST_PAIRS.map((p) => p.id));

  const letterRows = ARTICULATIONS.map((a) => {
    const rule = a.ruleId ? LESSON_RULES[a.ruleId] : undefined;
    const clip = has(`letters/${a.id}`) || has(`letters/${a.id}_fatha`);
    const exercise = (a.ruleId && LESSON_EXERCISE[a.ruleId]) || CONTRAST_PAIRS.some((p) => (p.a === a.id || p.b === a.id) && listenPairs.has(p.id));
    return { key: a.id, item: a.letters, name: a.nameAr, anim: true, audio: clip, example: !!rule && rule.examples.length > 0, exercise: !!exercise, note: a.needsReview ? `يُراجع: ${a.needsReview}` : '' };
  });
  const ruleRows = (Object.keys(TAG_RULES) as RuleId[]).map((r) => {
    const info = TAG_RULES[r];
    const lesson = LESSON_RULES[info.lesson];
    const anim = ['ghunnah', 'idgham_ghunnah', 'ikhfa', 'iqlab', 'mim_ikhfa', 'mim_idgham', 'imalah', 'madd_tabii', 'madd_muttasil', 'madd_munfasil', 'madd_lazim', 'madd_arid', 'qalqalah', 'tashil'].includes(r);
    const audio = !!lesson && lesson.examples.some((_, i) => has(`examples/${lesson.id}_${i + 1}`));
    const exercise = exerciseRules.has(r) || ['izhar', 'idgham_ghunnah', 'idgham_no_ghunnah', 'iqlab', 'ikhfa'].includes(r) || (info.group === 'madd' && r !== 'madd_silah') || ['farsh', 'isqat', 'tashil', 'idgham_duri', 'ya_fath', 'iskan', 'no_sakt', 'imalah'].includes(r) || DRILLS.some((d) => d.rules.includes(r));
    return { key: r, item: info.label, name: lesson?.name ?? info.lesson, anim, audio, example: !!lesson && lesson.examples.length > 0 && inText.has(r), exercise, note: r === 'taqlil' ? 'يُراجع: علامة التقليل في المصحف' : inText.has(r) ? '' : 'لا موضع له في سور المرحلة الأولى' };
  });
  const total = letterRows.length + ruleRows.length;
  const count = (k: 'anim' | 'audio' | 'example' | 'exercise') => [...letterRows, ...ruleRows].filter((r) => r[k]).length;

  const Table = ({ rows, head }: { rows: typeof letterRows; head: string }) => (
    <table>
      <thead>
        <tr>
          <th>{head}</th>
          <th>الاسم</th>
          <th>الحركة</th>
          <th>صوت المعلم</th>
          <th>مثال</th>
          <th>تمرين</th>
          <th>ملاحظة</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td className="q">{r.item}</td>
            <td>{r.name}</td>
            <td>{r.anim ? OK : NO}</td>
            <td>{teacher === null ? '…' : r.audio ? OK : NO}</td>
            <td>{r.example ? OK : NO}</td>
            <td>{r.exercise ? OK : NO}</td>
            <td>{r.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="checklist">
      <div className="card">
        <h2>قائمة الجاهزية</h2>
        <p className="ref">مسار المطوّر قبل الإصدار: كل حرف وكل قاعدة وكل خاصية للدوري، مع ✅/❌ للحركة وصوت المعلم والمثال والتمرين. عمود صوت المعلم يُقرأ مباشرة من المقاطع المسجّلة في هذا المتصفح.</p>
        <div className="row wrap">
          <span className="badge">الحركة {arNum(count('anim'))}/{arNum(total)}</span>
          <span className="badge">صوت المعلم {arNum(count('audio'))}/{arNum(total)}</span>
          <span className="badge">مثال {arNum(count('example'))}/{arNum(total)}</span>
          <span className="badge">تمرين {arNum(count('exercise'))}/{arNum(total)}</span>
        </div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>الحروف</h3>
        <Table rows={letterRows} head="الحرف" />
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>القواعد وخصائص الدوري</h3>
        <Table rows={ruleRows} head="القاعدة" />
      </div>
    </div>
  );
}
