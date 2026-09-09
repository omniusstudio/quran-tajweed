import { COLORS as C, TOP_VIEW } from './geometry';
import { Arrow } from './SideView';
import type { Pt, TopParams } from './types';

const TEETH = Array.from({ length: 14 }, (_, i) => {
  const t = i / 13;
  const ang = Math.PI * (0.05 + 0.9 * t);
  const ax = 100 + 68 * Math.cos(Math.PI - ang);
  const ay = 210 - 175 * Math.sin(ang) * 0.95;
  const r = i < 3 || i > 10 ? 9 : 6;
  return { x: ax - r / 2, y: ay - 6, w: r };
});

/** Top view: the tongue inside the upper dental arch (incisors at the top). */
export function TopView({ top, letters }: { top: TopParams; letters?: string }) {
  const w = top.width;
  const tipY = 60 - 16 * top.forward;
  const lx = 55 - 14 * w;
  const rx = 145 + 14 * w;
  const tongue = `M ${lx} 215 C ${lx} 130 ${70 - 8 * w} ${70 - 6 * top.forward} 100 ${tipY} C ${130 + 8 * w} ${70 - 6 * top.forward} ${rx} 130 ${rx} 215 Z`;
  const h = top.highlight;
  const leftFlow: Pt[] = [[44, 178], [40, 120], [56, 78]];
  const rightFlow: Pt[] = [[156, 178], [160, 120], [144, 78]];

  return (
    <svg viewBox={`0 0 ${TOP_VIEW.w} ${TOP_VIEW.h}`} role="img" aria-label="اللسان من أعلى">
      <rect width={TOP_VIEW.w} height={TOP_VIEW.h} fill="#fff" rx={10} />
      <path d="M 30 210 C 30 90 60 30 100 30 C 140 30 170 90 170 210" fill="none" stroke={C.ink} strokeWidth={2} />
      {TEETH.map((t, i) => (
        <rect key={i} x={t.x.toFixed(1)} y={t.y.toFixed(1)} width={t.w} height={12} rx={2} fill={C.teeth} stroke={C.ink} strokeWidth={1} />
      ))}
      <path d={tongue} fill={C.tongue} stroke={C.tongueEdge} strokeWidth={2} />

      {(h.sides ?? 0) > 0.01 && (
        <g opacity={h.sides}>
          <path d={`M ${lx + 5} 150 C ${lx + 7} 110 ${75 - 6 * w} 78 100 ${tipY + 2}`} fill="none" stroke={C.red} strokeWidth={7} strokeLinecap="round" />
          <path d={`M ${rx - 5} 150 C ${rx - 7} 110 ${125 + 6 * w} 78 100 ${tipY + 2}`} fill="none" stroke={C.red} strokeWidth={7} strokeLinecap="round" />
        </g>
      )}
      {(h.front_edge ?? 0) > 0.01 && <path d={`M 76 ${tipY + 22} C 86 ${tipY + 6} 114 ${tipY + 6} 124 ${tipY + 22}`} fill="none" stroke={C.red} strokeWidth={7} strokeLinecap="round" opacity={h.front_edge} />}
      {(h.tip ?? 0) > 0.01 && <circle cx={100} cy={tipY + 6} r={9} fill={C.red} fillOpacity={0.85} stroke="#fff" strokeWidth={2} opacity={h.tip} />}
      {(h.middle ?? 0) > 0.01 && <ellipse cx={100} cy={120} rx={26} ry={20} fill="none" stroke={C.red} strokeWidth={5} opacity={h.middle} />}
      {(h.back ?? 0) > 0.01 && <ellipse cx={100} cy={185} rx={34 + 6 * w} ry={18} fill="none" stroke={C.red} strokeWidth={5} opacity={h.back} />}

      {top.lateral > 0.01 && (
        <>
          <Arrow pts={leftFlow} opacity={top.lateral} />
          <Arrow pts={rightFlow} opacity={top.lateral} />
        </>
      )}
      {letters && (
        <text x={100} y={24} fontSize={22} fontFamily="var(--quran)" fill={C.green} textAnchor="middle" direction="rtl">
          {letters}
        </text>
      )}
    </svg>
  );
}
