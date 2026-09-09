import topBg from '../assets/art/top_bg.png';
import { TOP_SIZE, TOP_VIEWBOX, closedPath, polyline } from './artwork';
import { Arrow, GREEN, RED } from './SideView';
import type { Pt, TopShape } from './types';

const TONGUE = '#d9503a';
const TONGUE_EDGE = '#7a1d12';

/** Top view: the artwork's dental arch with the traced tongue morphing between the B-images. */
export function TopView({ top, letters }: { top: TopShape; letters?: string }) {
  const c = top.contour;
  const d = closedPath(c);
  const { w, h } = TOP_SIZE;
  const ys = c.map((p) => p[1]);
  const xs = c.map((p) => p[0]);
  const tipY = Math.min(...ys);
  const baseY = Math.max(...ys);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const tipIdx = ys.indexOf(tipY);
  const tip: Pt = c[tipIdx];
  const hl = top.highlight;

  // contour segments: the tip region and the two side edges (by index distance from the tip)
  const n = c.length;
  const seg = (from: number, to: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = from; i <= to; i++) out.push(c[((i % n) + n) % n]);
    return out;
  };
  const front = seg(tipIdx - Math.round(n * 0.07), tipIdx + Math.round(n * 0.07));
  const right = seg(tipIdx + Math.round(n * 0.05), tipIdx + Math.round(n * 0.36));
  const left = seg(tipIdx - Math.round(n * 0.36), tipIdx - Math.round(n * 0.05));
  const midY = tipY + (baseY - tipY) * 0.42;
  const backY = tipY + (baseY - tipY) * 0.74;

  return (
    <svg viewBox={TOP_VIEWBOX} role="img" aria-label="اللسان من أعلى">
      <rect width={w} height={h} fill="#fff" />
      <image href={topBg} width={w} height={h} />
      <path d={d} fill={TONGUE} stroke={TONGUE_EDGE} strokeWidth={5} strokeLinejoin="round" />
      {/* median line and highlight, as in the artwork */}
      <line x1={cx} y1={tipY + 70} x2={cx} y2={baseY - 60} stroke="#a8321f" strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      <path d={`M ${cx - 60} ${tipY + 120} C ${cx - 66} ${tipY + 90} ${cx - 50} ${tipY + 60} ${cx - 30} ${tipY + 44}`} fill="none" stroke="#f0a08e" strokeWidth={8} strokeLinecap="round" opacity={0.6} />

      {(hl.sides ?? 0) > 0.01 && (
        <g opacity={hl.sides} fill="none" stroke={RED} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round">
          <polyline points={polyline(left)} />
          <polyline points={polyline(right)} />
        </g>
      )}
      {(hl.front_edge ?? 0) > 0.01 && <polyline points={polyline(front)} fill="none" stroke={RED} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" opacity={hl.front_edge} />}
      {(hl.tip ?? 0) > 0.01 && <circle cx={tip[0]} cy={tip[1] + 14} r={19} fill={RED} fillOpacity={0.9} stroke="#fff" strokeWidth={4} opacity={hl.tip} />}
      {(hl.middle ?? 0) > 0.01 && <ellipse cx={cx} cy={midY} rx={70} ry={48} fill="none" stroke={RED} strokeWidth={8} strokeDasharray="14 10" opacity={hl.middle} />}
      {(hl.back ?? 0) > 0.01 && <ellipse cx={cx} cy={backY} rx={100} ry={52} fill="none" stroke={RED} strokeWidth={8} strokeDasharray="14 10" opacity={hl.back} />}

      {top.lateral > 0.01 && (
        <>
          <Arrow pts={[[cx - 175, baseY - 120], [cx - 185, midY], [cx - 130, tipY + 30]]} opacity={top.lateral} />
          <Arrow pts={[[cx + 175, baseY - 120], [cx + 185, midY], [cx + 130, tipY + 30]]} opacity={top.lateral} />
        </>
      )}
      {letters && (
        <text x={cx} y={baseY + 10} fontSize={56} fontFamily="var(--quran)" fill={GREEN} textAnchor="middle" direction="rtl">
          {letters}
        </text>
      )}
    </svg>
  );
}
