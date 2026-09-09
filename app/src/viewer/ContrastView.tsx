import { BY_ID } from './articulations';
import { ArticulationViewer } from './ArticulationViewer';
import { Controls } from './Controls';
import type { ContrastPair } from './types';
import { useClock } from './useClock';

/** Split screen: two articulations driven by one clock (PROMPT.md §5.3). */
export function ContrastView({ pair }: { pair: ContrastPair }) {
  const a = BY_ID[pair.a];
  const b = BY_ID[pair.b];
  const clock = useClock(Math.max(a.duration, b.duration));
  return (
    <div>
      <div className="contrast">
        <ArticulationViewer art={a} t={clock.t} compact />
        <ArticulationViewer art={b} t={clock.t} compact />
      </div>
      {pair.note && <p className="ref">{pair.note}</p>}
      <Controls clock={clock} />
    </div>
  );
}
