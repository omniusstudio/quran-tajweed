import { COLORS as C, LIPS_VIEW } from './geometry';
import type { LipParams } from './types';

const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

/** Front view of the lips, drawn from LipParams so every shape interpolates smoothly. */
export function LipsView({ lips, letters, flowOpacity = 0 }: { lips: LipParams; letters?: string; flowOpacity?: number }) {
  const cx = 100;
  const cy = 80;
  const roundP = Math.max(lips.round, 0);
  const spreadP = Math.max(-lips.round, 0);
  const halfW = 70 - 34 * roundP + 14 * spreadP;
  const aper = lips.open * 28 + roundP * 8 * lips.open; // half-height of the opening
  const thick = 11 + roundP * 7;
  const topOuter = cy - aper - thick;
  const botOuter = cy + aper + thick;
  const topInner = cy - aper;
  const botInner = lerp(cy + aper, cy + 2, lips.tuck);
  const bulge = 0.55 - roundP * 0.25; // how far the control points sit from the corners

  const outer = `M ${cx - halfW} ${cy} C ${cx - halfW * bulge} ${topOuter} ${cx + halfW * bulge} ${topOuter} ${cx + halfW} ${cy} C ${cx + halfW * bulge} ${botOuter} ${cx - halfW * bulge} ${botOuter} ${cx - halfW} ${cy} Z`;
  const innerW = halfW * 0.86;
  const aperture = `M ${cx - innerW} ${cy} C ${cx - innerW * bulge} ${topInner} ${cx + innerW * bulge} ${topInner} ${cx + innerW} ${cy} C ${cx + innerW * bulge} ${botInner} ${cx - innerW * bulge} ${botInner} ${cx - innerW} ${cy} Z`;

  const teethOpacity = Math.max(lips.teeth, lips.tuck) * Math.min(1, lips.open * 6 + lips.tuck);
  const teethY = lerp(topInner + 1, cy - 6, lips.tuck);
  const teethH = lerp(Math.min(12, aper * 0.9 + 2), 14, lips.tuck);

  return (
    <svg viewBox={`0 0 ${LIPS_VIEW.w} ${LIPS_VIEW.h}`} role="img" aria-label="الشفتان من الأمام">
      <rect width={LIPS_VIEW.w} height={LIPS_VIEW.h} fill={C.skin} rx={18} />
      {/* nose hint */}
      <path d="M 92 22 C 90 34 88 40 86 44 M 108 22 C 110 34 112 40 114 44" fill="none" stroke="#d9b39a" strokeWidth={2} strokeLinecap="round" />
      <path d={outer} fill={C.lip} stroke={C.ink} strokeWidth={2} />
      {lips.open > 0.02 && (
        <>
          <clipPath id="aperture">
            <path d={aperture} />
          </clipPath>
          <path d={aperture} fill={C.mouthDark} />
          <g clipPath="url(#aperture)" opacity={teethOpacity}>
            {Array.from({ length: 6 }, (_, i) => (
              <rect key={i} x={cx - 46 + i * 16} y={teethY} width={14} height={teethH} rx={2} fill={C.teeth} stroke={C.ink} strokeWidth={1} />
            ))}
          </g>
        </>
      )}
      {lips.tuck > 0.05 && (
        <g opacity={lips.tuck}>
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={cx - 46 + i * 16} y={cy - 7} width={14} height={13} rx={2} fill={C.teeth} stroke={C.ink} strokeWidth={1} />
          ))}
        </g>
      )}
      {lips.open <= 0.02 && <path d={`M ${cx - halfW} ${cy} C ${cx - halfW * 0.5} ${cy - 2} ${cx + halfW * 0.5} ${cy - 2} ${cx + halfW} ${cy}`} fill="none" stroke={C.ink} strokeWidth={2.5} />}
      {flowOpacity > 0.01 && (
        <g opacity={flowOpacity}>
          <circle cx={cx} cy={cy} r={aper + thick + 8} fill="none" stroke={C.blue} strokeWidth={2} strokeDasharray="4 4" />
        </g>
      )}
      {letters && (
        <text x={cx} y={140} fontSize={22} fontFamily="var(--quran)" fill={C.green} textAnchor="middle" direction="rtl">
          {letters}
        </text>
      )}
    </svg>
  );
}
