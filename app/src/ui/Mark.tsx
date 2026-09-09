// The نُطق mark: a dome with a crescent, a lotus rosette, and an open book. Inline SVG so it
// takes the current palette's gold and green; the raster icons in public/icons are the same drawing.
const GOLD = '#C9963B';

function petals(cx: number, cy: number, length: number, width: number, n: number, rot: number, sw: number, op = 1) {
  return Array.from({ length: n }, (_, k) => (
    <path key={`${length}-${k}`} d={`M${cx} ${cy} Q${cx - width} ${cy - length * 0.55} ${cx} ${cy - length} Q${cx + width} ${cy - length * 0.55} ${cx} ${cy} Z`} transform={`rotate(${rot + (k * 360) / n} ${cx} ${cy})`} strokeWidth={sw} opacity={op} />
  ));
}

export function Mark({ size = 40, book = 'var(--primary)', pageGap = 'var(--surface)' }: { size?: number; book?: string; pageGap?: string }) {
  const star = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 11 : 4.6;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    return `${(296 + r * Math.cos(a)).toFixed(1)},${(72 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden focusable="false" className="mark">
      <defs>
        <mask id="nutq-cres">
          <rect width="512" height="512" fill="#fff" />
          <circle cx="270" cy="86" r="24" fill="#000" />
        </mask>
      </defs>
      <g fill="none" stroke={GOLD} strokeLinecap="round" strokeLinejoin="round">
        <path d="M120 386 V330 C120 284 150 244 196 226 C230 212 250 190 256 158 C262 190 282 212 316 226 C362 244 392 284 392 330 V386" strokeWidth={24} />
        <path d="M256 158 V132" strokeWidth={10} />
        <g>
          {petals(256, 266, 72, 23, 8, 0, 2.8)}
          {petals(256, 266, 54, 18, 8, 22.5, 2.5, 0.9)}
          {petals(256, 266, 36, 13, 8, 0, 2.2, 0.9)}
          <circle cx="256" cy="266" r="5" fill={GOLD} stroke="none" />
        </g>
      </g>
      <circle cx="256" cy="92" r="32" fill={GOLD} mask="url(#nutq-cres)" />
      <polygon points={star} fill={GOLD} />
      <g fill={book} stroke={pageGap} strokeWidth={8} paintOrder="stroke">
        <path d="M36 440 C124 400 206 410 256 462 C306 410 388 400 476 440 L476 458 C388 420 306 430 256 482 C206 430 124 420 36 458 Z" />
        <path d="M46 418 C130 380 206 388 256 438 C306 388 382 380 466 418 L466 434 C382 398 306 406 256 456 C206 406 130 398 46 434 Z" />
        <path d="M60 396 C138 362 208 368 256 414 C304 368 374 362 452 396 L452 410 C374 378 304 384 256 430 C208 384 138 378 60 410 Z" />
      </g>
    </svg>
  );
}
