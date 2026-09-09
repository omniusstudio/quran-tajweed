import { useEffect } from 'react';
import type { Example } from '../content/lessons';
import { linkTerms } from '../content/terms';
import { refImage } from '../content/refImages';
import { BY_ID } from '../viewer/articulations';
import { ArticulationViewer } from '../viewer/ArticulationViewer';
import { Controls } from '../viewer/Controls';
import { useClock } from '../viewer/useClock';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const arNum = (n: number | null | undefined) => (n == null ? '—' : String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]));

/** Verse text with the target words highlighted; long verses are trimmed to a window around the hits. */
export function Ayah({ ex, maxWords = 22 }: { ex: Example; maxWords?: number }) {
  let lo = 0;
  let hi = ex.words.length;
  if (ex.words.length > maxWords && ex.hit.length) {
    const first = Math.min(...ex.hit);
    const last = Math.max(...ex.hit);
    const span = Math.max(maxWords, last - first + 8);
    lo = Math.max(0, Math.min(first - 4, Math.floor((first + last) / 2) - Math.floor(span / 2)));
    hi = Math.min(ex.words.length, Math.max(last + 5, lo + span));
    lo = Math.max(0, Math.min(lo, hi - span));
  }
  return (
    <div>
      <div className="ayah" dir="rtl">
        {lo > 0 && '… '}
        {ex.words.slice(lo, hi).map((w, j) => {
          const i = lo + j;
          return (
            <span key={i}>
              {ex.hit.includes(i) ? <span className="hl">{w}</span> : w}{' '}
            </span>
          );
        })}
        {hi < ex.words.length && ' …'}
      </div>
      <div className="ref">
        {ex.surahName}، الآية {arNum(ex.basri)} (حفص: {arNum(ex.kufi)})
      </div>
    </div>
  );
}

/** Lesson text with the first use of each dictionary term linked. */
export function LinkedText({ text, skipRuleId, onTerm }: { text: string; skipRuleId?: string; onTerm: (ruleId: string) => void }) {
  return (
    <p>
      {linkTerms(text, skipRuleId).map((part, i) =>
        part.termRuleId ? (
          <a key={i} className="term" href={`#/dictionary/${part.termRuleId}`} onClick={(e) => { e.preventDefault(); onTerm(part.termRuleId!); }}>
            {part.text}
          </a>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

export function Figures({ figures }: { figures: { img: string | null; caption: string }[] }) {
  if (!figures.length) return null;
  return (
    <div className="figs">
      {figures.map((f, i) => (
        <figure key={i} className="fig" style={{ margin: 0 }}>
          {f.img && refImage(f.img) && <img src={refImage(f.img)} alt={f.caption} loading="lazy" />}
          <figcaption>{f.caption}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** A viewer with its own clock and controls; `id` may change (the parent shows chips). */
export function LetterViewer({ id, autoplay = true }: { id: string; autoplay?: boolean }) {
  const art = BY_ID[id];
  const clock = useClock(art.duration, autoplay);
  useEffect(() => clock.restart(), [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <ArticulationViewer art={art} t={clock.t} />
      <Controls clock={clock} />
    </div>
  );
}
