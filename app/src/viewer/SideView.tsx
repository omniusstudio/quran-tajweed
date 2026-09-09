import { AIRFLOW_PATHS, COLORS as C, HEAD, JAW_DROP, LANDMARKS, SIDE_VIEW, floorAt, polyline, smoothPath, velumPath } from './geometry';
import type { Pt, ViewState } from './types';

export function Arrow({ pts, color = C.blue, opacity = 1, animated = true }: { pts: Pt[]; color?: string; opacity?: number; animated?: boolean }) {
  if (pts.length < 2) return null;
  const [x1, y1] = pts[pts.length - 2];
  const [x2, y2] = pts[pts.length - 1];
  const a = Math.atan2(y2 - y1, x2 - x1);
  const L = 10;
  const p1: Pt = [x2 - L * Math.cos(a - 0.5), y2 - L * Math.sin(a - 0.5)];
  const p2: Pt = [x2 - L * Math.cos(a + 0.5), y2 - L * Math.sin(a + 0.5)];
  return (
    <g opacity={opacity} style={{ transition: 'opacity 120ms linear' }}>
      <polyline points={polyline(pts)} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeDasharray={animated ? '10 6' : undefined} className={animated ? 'flow' : undefined} />
      <polygon points={`${x2},${y2} ${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`} fill={color} />
    </g>
  );
}

export function SideView({ state, letters, showFlow = true }: { state: ViewState; letters?: string; showFlow?: boolean }) {
  const jawDy = state.jaw * JAW_DROP;
  const tonguePath = smoothPath(state.tongue, floorAt(state.jaw));
  const flow = state.airflow && state.airflow.type !== 'lateral' ? AIRFLOW_PATHS[state.airflow.type] : null;
  const nasalGlow = state.airflow?.type === 'nasal' ? state.airflow.opacity : 0;

  return (
    <svg viewBox={`0 0 ${SIDE_VIEW.w} ${SIDE_VIEW.h}`} role="img" aria-label="مقطع جانبي للفم">
      <style>{`.flow { animation: flowdash 0.6s linear infinite; } @keyframes flowdash { to { stroke-dashoffset: -16; } }`}</style>
      <rect width={SIDE_VIEW.w} height={SIDE_VIEW.h} fill="#fff" />
      <path d={HEAD.profile} fill={C.skin} stroke={C.ink} strokeWidth={2.2} />
      <path d={HEAD.nasalCavity} fill={C.nasal} stroke={C.ink} strokeWidth={1.4} />
      <path d={HEAD.nasalCavity} fill="#f6b3b3" opacity={nasalGlow * 0.8} />
      <path d={HEAD.oralCavity} fill={C.cavity} />

      {/* lower jaw group follows the jaw */}
      <g transform={`translate(0 ${jawDy.toFixed(1)})`}>
        <path d={HEAD.floorOfMouth} fill="none" stroke={C.ink} strokeWidth={2} />
      </g>

      <path d={tonguePath} fill={C.tongue} stroke={C.tongueEdge} strokeWidth={2} />

      <path d={HEAD.hardPalate} fill="none" stroke={C.ink} strokeWidth={3} />
      <path d={velumPath(state.velum)} fill="none" stroke={C.velum} strokeWidth={3} strokeLinecap="round" />
      <path d={HEAD.pharynxWall} fill="none" stroke={C.ink} strokeWidth={2.4} />
      <path d={HEAD.vocalFolds} fill="none" stroke={C.ink} strokeWidth={2.2} />
      <line x1={272} y1={300} x2={314} y2={300} stroke={C.ink} strokeWidth={3} />
      <path d={HEAD.upperTeeth} fill={C.teeth} stroke={C.ink} strokeWidth={1.5} />
      <g transform={`translate(0 ${jawDy.toFixed(1)})`}>
        <path d={HEAD.lowerTeeth} fill={C.teeth} stroke={C.ink} strokeWidth={1.5} />
      </g>
      {HEAD.upperMolars.map((m, i) => (
        <rect key={i} x={m.x} y={m.y} width={m.w} height={m.h} rx={3} fill={C.teeth} stroke={C.ink} strokeWidth={1.2} />
      ))}

      {/* heavy: the raised back of the tongue */}
      {state.heavy > 0.01 && (
        <g opacity={state.heavy}>
          <circle cx={LANDMARKS.heavyRing[0]} cy={LANDMARKS.heavyRing[1]} r={20} fill="none" stroke={C.red} strokeWidth={3} strokeDasharray="4 3" />
          <text x={LANDMARKS.heavyRing[0]} y={LANDMARKS.heavyRing[1] - 26} fontSize={12} fill={C.red} textAnchor="middle" fontFamily="var(--ui)">مفخم</text>
        </g>
      )}

      {showFlow && flow && state.airflow && <Arrow pts={flow} opacity={state.airflow.opacity} />}

      {state.contact && state.contact.opacity > 0.01 && (
        state.contact.kind === 'touch' ? (
          <circle cx={state.contact.pt[0]} cy={state.contact.pt[1]} r={9} fill={C.red} fillOpacity={0.85 * state.contact.opacity} stroke="#fff" strokeWidth={2} strokeOpacity={state.contact.opacity} />
        ) : (
          <circle cx={state.contact.pt[0]} cy={state.contact.pt[1]} r={14} fill="none" stroke={C.red} strokeWidth={3} strokeDasharray="4 3" opacity={state.contact.opacity} />
        )
      )}

      {letters && (
        <text x={360} y={62} fontSize={34} fontFamily="var(--quran)" fill={C.green} textAnchor="middle" direction="rtl">
          {letters}
        </text>
      )}
    </svg>
  );
}
