import type { Clock, Speed } from './useClock';

const SPEEDS: { v: Speed; label: string }[] = [
  { v: 0.25, label: '٠٫٢٥×' },
  { v: 0.5, label: '٠٫٥×' },
  { v: 1, label: '١×' },
];

export function Controls({ clock }: { clock: Clock }) {
  return (
    <div className="controls" role="group" aria-label="التحكم في الحركة">
      <button className="play" onClick={clock.toggle} aria-label={clock.playing ? 'إيقاف مؤقت' : 'تشغيل'}>
        {clock.playing ? '❚❚' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(clock.t * 1000)}
        onChange={(e) => clock.seek(Number(e.target.value) / 1000)}
        onPointerDown={() => clock.playing && clock.toggle()}
        aria-label="شريط الزمن"
      />
      <div className="speeds" role="group" aria-label="السرعة">
        {SPEEDS.map((s) => (
          <button key={s.v} aria-pressed={clock.speed === s.v} onClick={() => clock.setSpeed(s.v)}>
            {s.label}
          </button>
        ))}
      </div>
      <button className="toggle" aria-pressed={clock.loop} onClick={() => clock.setLoop(!clock.loop)}>
        تكرار
      </button>
    </div>
  );
}
