// The sūrah heading as the printed muṣḥaf draws it: a green ornamental band across the line, the
// name in a white cartouche in the middle, a medallion on each side with the verse count and the
// sūrah's order. Solid fills only (no gradient references), so it renders the same everywhere.

import { arNum } from '../pages/shared';

const LEAF = 'M0 0c5-7 11-7 16 0c-5 7-11 7-16 0z';

function Vine({ x, w, flip = false }: { x: number; w: number; flip?: boolean }) {
  const n = Math.max(1, Math.floor(w / 22));
  return (
    <g transform={`translate(${x} 23)${flip ? ` scale(-1 1) translate(${-w} 0)` : ''}`}>
      <path d={`M0 0 ${Array.from({ length: n }, (_, i) => `q11 ${i % 2 ? 9 : -9} 22 0`).join(' ')}`} className="stem" />
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${i * 22 + 11} ${i % 2 ? 5 : -5}) rotate(${i % 2 ? 40 : -40})`}>
          <path d={LEAF} className="leaf" />
        </g>
      ))}
    </g>
  );
}

function Medallion({ x, top, value }: { x: number; top: string; value: string }) {
  return (
    <g transform={`translate(${x} 23)`}>
      <circle r="19.5" className="med-ring" />
      <circle r="16.5" className="med-face" />
      <path d="M0 -16.5 L3 -11.5 L0 -6.5 L-3 -11.5 Z M0 16.5 L3 11.5 L0 6.5 L-3 11.5 Z M16.5 0 L11.5 3 L6.5 0 L11.5 -3 Z M-16.5 0 L-11.5 3 L-6.5 0 L-11.5 -3 Z" className="med-pips" />
      <text y="-3" className="med-top">{top}</text>
      <text y="9.5" className="med-value">{value}</text>
    </g>
  );
}

export function SurahBand({ name, order, count }: { name: string; order: number; count: number }) {
  const W = 600;
  return (
    <svg className="surah-band" viewBox={`0 0 ${W} 46`} role="img" aria-label={`${name}، آياتها ${arNum(count)}، ترتيبها ${arNum(order)}`}>
      <rect x="2" y="3" width={W - 4} height="40" rx="5" className="band-bg" />
      <rect x="2" y="3" width={W - 4} height="18" rx="5" className="band-light" />
      <rect x="4.5" y="5.5" width={W - 9} height="35" rx="3.5" className="band-rule" />
      <rect x="8" y="9" width={W - 16} height="28" rx="2.5" className="band-rule faint" />
      <Vine x={62} w={110} />
      <Vine x={428} w={110} flip />
      <path d={`M${W / 2 - 100} 23 l12 -14 h176 l12 14 l-12 14 h-176 z`} className="cartouche" />
      <path d={`M${W / 2 - 93} 23 l9.5 -11 h167 l9.5 11 l-9.5 11 h-167 z`} className="cartouche-inner" />
      <text x={W / 2} y="29.5" className="band-name">{name}</text>
      <Medallion x={W - 30} top="آياتها" value={arNum(count)} />
      <Medallion x={30} top="ترتيبها" value={arNum(order)} />
    </svg>
  );
}
