// Small, honest celebrations: a lesson done, a section finished, the daily goal reached, a streak
// milestone, a run of right answers. One overlay, a short chime, confetti unless motion is reduced.

import { useEffect, useState } from 'react';
import { Icon, type IconName } from './icons';
import { reducedMotion } from './settings';
import { sfx } from './sound';

export type CelebrationKind = 'lesson' | 'section' | 'goal' | 'streak' | 'run' | 'drill';

export interface Celebration {
  kind: CelebrationKind;
  title: string;
  text?: string;
}

const ICONS: Record<CelebrationKind, IconName> = { lesson: 'check', section: 'trophy', goal: 'target', streak: 'flame', run: 'sparkles', drill: 'star' };
const BIG: CelebrationKind[] = ['section', 'goal', 'streak'];

export function celebrate(c: Celebration) {
  window.dispatchEvent(new CustomEvent<Celebration>('nutq:celebrate', { detail: c }));
}

const PIECES = Array.from({ length: 18 }, (_, i) => ({
  left: 8 + ((i * 37) % 84),
  delay: (i % 6) * 60,
  hue: [150, 42, 205, 12, 150, 42][i % 6],
  rotate: (i * 53) % 360,
  size: 6 + (i % 3) * 3,
}));

/** Mount once near the root; listens for `celebrate()` calls. */
export function Celebrations() {
  const [c, setC] = useState<Celebration | null>(null);
  useEffect(() => {
    let timer = 0;
    const on = (e: Event) => {
      const detail = (e as CustomEvent<Celebration>).detail;
      setC(detail);
      sfx(BIG.includes(detail.kind) ? 'fanfare' : 'complete');
      clearTimeout(timer);
      timer = window.setTimeout(() => setC(null), BIG.includes(detail.kind) ? 4200 : 2600);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setC(null);
    addEventListener('nutq:celebrate', on);
    addEventListener('keydown', key);
    return () => {
      removeEventListener('nutq:celebrate', on);
      removeEventListener('keydown', key);
      clearTimeout(timer);
    };
  }, []);
  if (!c) return <div className="sr-only" aria-live="polite" />;
  const big = BIG.includes(c.kind);
  const confetti = big && !reducedMotion();
  return (
    <div className={`celebrate${big ? ' big' : ''}`} role="status" aria-live="polite" onClick={() => setC(null)}>
      {confetti && (
        <div className="confetti" aria-hidden>
          {PIECES.map((p, i) => (
            <span key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}ms`, background: `hsl(${p.hue} 70% 55%)`, width: p.size, height: p.size * 1.6, transform: `rotate(${p.rotate}deg)` }} />
          ))}
        </div>
      )}
      <div className="celebrate-card">
        <span className={`celebrate-icon ${c.kind}`}>
          <Icon name={ICONS[c.kind]} size={big ? 34 : 24} />
        </span>
        <div>
          <strong>{c.title}</strong>
          {c.text && <p>{c.text}</p>}
        </div>
      </div>
    </div>
  );
}
