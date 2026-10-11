// The sūrah heading as the printed muṣḥaf draws it: a green ornamental band, the name in a white
// cartouche in the middle, a medallion on each side with the verse count and the sūrah's order.
// Inline SVG, so it scales with the page and takes the paper colour from the theme.

import { arNum } from '../pages/shared';

const LEAF = 'M0 0c6-9 14-9 20 0c-6 9-14 9-20 0z';

function Vine({ x, w, flip = false }: { x: number; w: number; flip?: boolean }) {
  const n = Math.max(1, Math.floor(w / 26));
  return (
    <g transform={`translate(${x} 36)${flip ? ` scale(-1 1) translate(${-w} 0)` : ''}`} className="vine">
      <path d={`M0 0 ${Array.from({ length: n }, (_, i) => `q${13} ${i % 2 ? 12 : -12} ${26} 0`).join(' ')}`} className="stem" />
      {Array.from({ length: n }, (_, i) => (
        <g key={i} transform={`translate(${i * 26 + 13} ${i % 2 ? 6 : -6}) rotate(${i % 2 ? 40 : -40})`}>
          <path d={LEAF} className="leaf" />
        </g>
      ))}
    </g>
  );
}

function Medallion({ x, top, value }: { x: number; top: string; value: string }) {
  return (
    <g transform={`translate(${x} 36)`}>
      <circle r="27" className="med-ring" />
      <circle r="23" className="med-face" />
      <path d="M0 -23 L4 -16 L0 -9 L-4 -16 Z M0 23 L4 16 L0 9 L-4 16 Z M23 0 L16 4 L9 0 L16 -4 Z M-23 0 L-16 4 L-9 0 L-16 -4 Z" className="med-pips" />
      <text y="-4" className="med-top">{top}</text>
      <text y="13" className="med-value">{value}</text>
    </g>
  );
}

export function SurahBand({ name, order, count }: { name: string; order: number; count: number }) {
  const W = 600;
  return (
    <svg className="surah-band" viewBox={`0 0 ${W} 72`} role="img" aria-label={`${name}، آياتها ${arNum(count)}، ترتيبها ${arNum(order)}`}>
      <defs>
        <linearGradient id="band-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2f7a44" />
          <stop offset=".5" stopColor="#1f6a3a" />
          <stop offset="1" stopColor="#16512c" />
        </linearGradient>
        <linearGradient id="band-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b8923a" />
          <stop offset=".5" stopColor="#e9d08a" />
          <stop offset="1" stopColor="#b8923a" />
        </linearGradient>
      </defs>
      <rect x="4" y="8" width={W - 8} height="56" rx="6" fill="url(#band-green)" />
      <rect x="7" y="11" width={W - 14} height="50" rx="4" fill="none" stroke="url(#band-gold)" strokeWidth="1.4" />
      <rect x="11" y="15" width={W - 22} height="42" rx="3" fill="none" stroke="#e9d08a" strokeOpacity=".35" strokeWidth=".8" />
      <Vine x={78} w={110} />
      <Vine x={412} w={110} flip />
      {/* the name cartouche */}
      <path d={`M${W / 2 - 112} 36 l14 -18 h196 l14 18 l-14 18 h-196 z`} className="cartouche" />
      <path d={`M${W / 2 - 104} 36 l11 -14 h186 l11 14 l-11 14 h-186 z`} className="cartouche-inner" />
      <text x={W / 2} y="44" className="band-name">{name}</text>
      {/* medallions: verse count on the right, order on the left (the page reads right to left) */}
      <Medallion x={W - 44} top="آياتها" value={arNum(count)} />
      <Medallion x={44} top="ترتيبها" value={arNum(order)} />
    </svg>
  );
}
