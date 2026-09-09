import sideClosed from '../assets/art/side_closed.png';
import sideHalf from '../assets/art/side_half.png';
import sideOpen from '../assets/art/side_open.png';
import teethClosed from '../assets/art/teeth_closed.png';
import teethHalf from '../assets/art/teeth_half.png';
import teethOpen from '../assets/art/teeth_open.png';
import { AIRFLOW_PATHS, LANDMARKS, SIDE_SIZE, SIDE_VIEWBOX, VELUM_CLOSED, VELUM_OPEN, closedPath, lerpNums, polyline } from './artwork';
import type { Pt, ViewState } from './types';

export const INK = '#7a2a22';
export const RED = '#c81e1e';
export const BLUE = '#1d63b5';
export const GREEN = '#1f7a4d';
const TONGUE = '#d8553f';
const TONGUE_EDGE = '#8f2a20';
const VELUM = '#efb9b0';

export function Arrow({ pts, color = BLUE, opacity = 1, width = 7 }: { pts: Pt[]; color?: string; opacity?: number; width?: number }) {
  if (pts.length < 2) return null;
  const [x1, y1] = pts[pts.length - 2];
  const [x2, y2] = pts[pts.length - 1];
  const a = Math.atan2(y2 - y1, x2 - x1);
  const L = width * 3.2;
  const p1: Pt = [x2 - L * Math.cos(a - 0.5), y2 - L * Math.sin(a - 0.5)];
  const p2: Pt = [x2 - L * Math.cos(a + 0.5), y2 - L * Math.sin(a + 0.5)];
  return (
    <g opacity={opacity} style={{ transition: 'opacity 120ms linear' }}>
      <polyline points={polyline(pts)} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${width * 3} ${width * 2}`} className="flow" />
      <polygon points={`${x2},${y2} ${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`} fill={color} />
    </g>
  );
}

/** Jaw 0..1 → crossfade weights for the closed / half / open backgrounds. */
export function jawWeights(jaw: number): [number, number, number] {
  if (jaw <= 0.5) return [1 - jaw * 2, jaw * 2, 0];
  return [0, 2 - jaw * 2, jaw * 2 - 1];
}

function velumPath(v: number): string {
  const n = lerpNums(VELUM_OPEN, VELUM_CLOSED, v);
  return `M ${n[0]} ${n[1]} C ${n[2]} ${n[3]} ${n[4]} ${n[5]} ${n[6]} ${n[7]}`;
}

export function SideView({ state, letters, showFlow = true }: { state: ViewState; letters?: string; showFlow?: boolean }) {
  const [wc, wh, wo] = jawWeights(state.jaw);
  const tonguePath = closedPath(state.tongue);
  const flow = state.airflow && state.airflow.type !== 'lateral' ? AIRFLOW_PATHS[state.airflow.type] : null;
  const nasalGlow = state.airflow?.type === 'nasal' ? state.airflow.opacity : 0;
  const velumTip = lerpNums(VELUM_OPEN, VELUM_CLOSED, state.velum).slice(6, 8);
  const { w, h } = SIDE_SIZE;

  return (
    <svg viewBox={SIDE_VIEWBOX} role="img" aria-label="مقطع جانبي للفم">
      <style>{`.flow { animation: flowdash 0.7s linear infinite; } @keyframes flowdash { to { stroke-dashoffset: -35; } }`}</style>
      <rect width={w} height={h} fill="#fff" />
      <image href={sideClosed} width={w} height={h} opacity={wc} />
      {wh > 0.001 && <image href={sideHalf} width={w} height={h} opacity={wh} />}
      {wo > 0.001 && <image href={sideOpen} width={w} height={h} opacity={wo} />}

      {/* nasal cavity glow while air goes through the nose */}
      {nasalGlow > 0.01 && <path d="M 240 400 C 300 300 520 260 640 300 L 700 420 C 560 380 330 400 235 415 Z" fill="#f4a6a6" opacity={nasalGlow * 0.55} />}

      {/* soft palate + uvula (vector, so it can rise) */}
      <path d={velumPath(state.velum)} fill="none" stroke={INK} strokeWidth={27} strokeLinecap="round" opacity={0.85} />
      <path d={velumPath(state.velum)} fill="none" stroke={VELUM} strokeWidth={22} strokeLinecap="round" />
      <circle cx={velumTip[0]} cy={velumTip[1]} r={14} fill={VELUM} stroke={INK} strokeWidth={2.5} />

      {/* the tongue */}
      <path d={tonguePath} fill={TONGUE} stroke={TONGUE_EDGE} strokeWidth={5} strokeLinejoin="round" />
      <path d={tonguePath} fill="none" stroke="#f08a75" strokeWidth={10} opacity={0.35} transform="translate(0 12)" clipPath="url(#tongueClip)" />
      <clipPath id="tongueClip">
        <path d={tonguePath} />
      </clipPath>

      {/* teeth in front of the tongue */}
      <image href={teethClosed} width={w} height={h} opacity={wc} />
      {wh > 0.001 && <image href={teethHalf} width={w} height={h} opacity={wh} />}
      {wo > 0.001 && <image href={teethOpen} width={w} height={h} opacity={wo} />}

      {/* heavy: the raised back of the tongue */}
      {state.heavy > 0.01 && (
        <g opacity={state.heavy}>
          <circle cx={LANDMARKS.heavyRing.c[0]} cy={LANDMARKS.heavyRing.c[1]} r={LANDMARKS.heavyRing.r} fill="none" stroke={RED} strokeWidth={7} strokeDasharray="14 10" />
          <text x={LANDMARKS.heavyRing.c[0]} y={LANDMARKS.heavyRing.c[1] - LANDMARKS.heavyRing.r - 14} fontSize={30} fill={RED} textAnchor="middle" fontFamily="var(--ui)">
            مفخم
          </text>
        </g>
      )}

      {showFlow && flow && state.airflow && <Arrow pts={flow} opacity={state.airflow.opacity} />}

      {state.contact && state.contact.opacity > 0.01 && (
        state.contact.kind === 'touch' ? (
          <circle cx={state.contact.pt[0]} cy={state.contact.pt[1]} r={19} fill={RED} fillOpacity={0.9 * state.contact.opacity} stroke="#fff" strokeWidth={4} strokeOpacity={state.contact.opacity} />
        ) : (
          <circle cx={state.contact.pt[0]} cy={state.contact.pt[1]} r={LANDMARKS.imalahRing.r * 0.55} fill="none" stroke={RED} strokeWidth={7} strokeDasharray="14 10" opacity={state.contact.opacity} />
        )
      )}

      {letters && (
        <text x={780} y={170} fontSize={84} fontFamily="var(--quran)" fill={GREEN} textAnchor="middle" direction="rtl">
          {letters}
        </text>
      )}
    </svg>
  );
}
