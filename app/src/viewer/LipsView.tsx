import lipsBg from '../assets/art/lips_bg.png';
import { LIPS_SIZE, LIPS_VIEWBOX, closedPath } from './artwork';
import { BLUE, GREEN } from './SideView';
import type { LipsShape } from './types';

const LIP = '#c56a67';
const LIP_EDGE = '#7d3a3a';
const LIP_LINE = '#a04d4d';
const MOUTH = '#3f1517';
const TEETH = '#ffffff';
const TEETH_EDGE = '#9a8d86';
const TONGUE = '#cb5d4e';

/** Front view: the artwork's face with vector lips, opening, teeth and tongue morphing between the C-images. */
export function LipsView({ lips, letters, flowOpacity = 0 }: { lips: LipsShape; letters?: string; flowOpacity?: number }) {
  const outer = closedPath(lips.outer);
  const inner = closedPath(lips.inner);
  const { w, h } = LIPS_SIZE;
  const xs = lips.outer.map((p) => p[0]);
  const ys = lips.outer.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + 26;
  const ry = (Math.max(...ys) - Math.min(...ys)) / 2 + 26;
  const showOpening = lips.openness > 0.02;

  return (
    <svg viewBox={LIPS_VIEWBOX} role="img" aria-label="الشفتان من الأمام">
      <rect width={w} height={h} fill="#fff" />
      <image href={lipsBg} width={w} height={h} />
      {showOpening && (
        <>
          <clipPath id="mouthClip">
            <path d={inner} />
          </clipPath>
          <path d={inner} fill={MOUTH} opacity={lips.openness} />
          <g clipPath="url(#mouthClip)">
            {lips.tongueOpacity > 0.01 && <path d={closedPath(lips.tongue)} fill={TONGUE} stroke="#8f2a20" strokeWidth={3} opacity={lips.tongueOpacity} />}
            {lips.teethUpperOpacity > 0.01 && <TeethRow d={closedPath(lips.teethUpper)} pts={lips.teethUpper} opacity={lips.teethUpperOpacity} />}
            {lips.teethLowerOpacity > 0.01 && <TeethRow d={closedPath(lips.teethLower)} pts={lips.teethLower} opacity={lips.teethLowerOpacity} />}
          </g>
        </>
      )}
      <path d={`${outer} ${showOpening ? inner : ''}`} fillRule="evenodd" fill={LIP} stroke={LIP_EDGE} strokeWidth={4} strokeLinejoin="round" />
      <path d={inner} fill="none" stroke={LIP_LINE} strokeWidth={3} opacity={showOpening ? 0.5 : 1} />
      {/* soft shading on the lower lip */}
      <path d={outer} fill="url(#lipShade)" opacity={0.35} />
      <defs>
        <linearGradient id="lipShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#5a1d1d" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {flowOpacity > 0.01 && <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={BLUE} strokeWidth={5} strokeDasharray="12 10" opacity={flowOpacity} />}
      {letters && (
        <text x={512} y={510} fontSize={60} fontFamily="var(--quran)" fill={GREEN} textAnchor="middle" direction="rtl">
          {letters}
        </text>
      )}
    </svg>
  );
}

function TeethRow({ d, pts, opacity }: { d: string; pts: [number, number][]; opacity: number }) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const seps: number[] = [];
  const cx = (x0 + x1) / 2;
  for (let x = cx; x < x1 - 8; x += 44) seps.push(x);
  for (let x = cx - 44; x > x0 + 8; x -= 44) seps.push(x);
  return (
    <g opacity={opacity}>
      <path d={d} fill={TEETH} stroke={TEETH_EDGE} strokeWidth={2.5} strokeLinejoin="round" />
      <clipPath id={`teeth${Math.round(y0)}`}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#teeth${Math.round(y0)})`}>
        {seps.map((x) => (
          <line key={x} x1={x} y1={y0} x2={x} y2={y1} stroke={TEETH_EDGE} strokeWidth={1.5} opacity={0.7} />
        ))}
      </g>
    </g>
  );
}
