// The sky over the learner's place, as seen facing the sun's side of it: the sun's true path for
// the day (from its real azimuth and altitude), the prayers as beads along that path, a sun that
// rises out of and sinks behind the horizon, and the moon where it really is, lit as it really is.

import { useMemo } from 'react';
import { moonState, sunPosition } from '../../server/prayer.mjs';
import type { PrayerKey } from '../content/prayer';

const W = 400;
const H = 176;
const ALT_BOTTOM = -22;

/** A moon disc lit from the side: `lit` 0 … 1, the lit limb on the right when waxing (northern sky). */
export function MoonDisc({ r, lit, waxing, south = false, id = 'm', halo = true }: { r: number; lit: number; waxing: boolean; south?: boolean; id?: string; halo?: boolean }) {
  const k = Math.min(1, Math.max(0, lit));
  const rx = r * Math.abs(1 - 2 * k);
  const litPath = `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx} ${r} 0 0 ${k > 0.5 ? 1 : 0} 0 ${-r} Z`;
  const flip = waxing !== south ? 1 : -1;
  return (
    <g className="moon-disc">
      <defs>
        <radialGradient id={`${id}-lit`} cx="38%" cy="36%" r="75%">
          <stop offset="0" stopColor="#fffdf4" />
          <stop offset=".7" stopColor="#e9e4d2" />
          <stop offset="1" stopColor="#c9c4b4" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset=".25" stopColor="#dfe9ff" stopOpacity={0.30 * (0.35 + 0.65 * k)} />
          <stop offset="1" stopColor="#dfe9ff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}><path d={litPath} transform={`scale(${flip} 1)`} /></clipPath>
        <clipPath id={`${id}-disc`}><circle r={r} /></clipPath>
        <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={r * 0.06} /></filter>
      </defs>
      {halo && <circle r={r * 3.4} fill={`url(#${id}-halo)`} />}
      <circle r={r} fill="#0b1422" opacity=".55" />
      <circle r={r} fill="#cdd6e6" opacity=".10" />
      <g clipPath={`url(#${id}-disc)`}><g filter={`url(#${id}-soft)`}><g clipPath={`url(#${id}-clip)`}>
        <circle r={r} fill={`url(#${id}-lit)`} />
        <g fill="#8d8a7c" opacity=".26">
          <circle cx={-r * 0.3} cy={-r * 0.32} r={r * 0.2} />
          <circle cx={r * 0.26} cy={-r * 0.05} r={r * 0.27} />
          <circle cx={-r * 0.12} cy={r * 0.42} r={r * 0.16} />
          <circle cx={r * 0.46} cy={r * 0.46} r={r * 0.11} />
          <circle cx={-r * 0.52} cy={r * 0.1} r={r * 0.1} />
        </g>
      </g></g></g>
    </g>
  );
}

/** The sun's colours by height: pale gold overhead, deep orange with a red rim near the horizon. */
function sunTint(alt: number) {
  if (alt < 7) return { heart: '#fff0b8', body: '#ffc15e', limb: '#f26522', rim: '#d73a4d', glow: '#ff7e3d' };
  if (alt < 24) return { heart: '#fffbd0', body: '#ffe48a', limb: '#fb8a2a', rim: '#ee5a2a', glow: '#ffae4a' };
  return { heart: '#fffef0', body: '#fff3a8', limb: '#ffb347', rim: '#ff8a3c', glow: '#ffd36b' };
}

const BOIL = [
  { a: 0, d: 1.7, r: 12.6, t: 17 }, { a: 52, d: 2.1, r: 12.2, t: -23 }, { a: 118, d: 1.5, r: 12.8, t: 29 }, { a: 171, d: 2.3, r: 12.0, t: -19 },
  { a: 233, d: 1.8, r: 12.5, t: 31 }, { a: 287, d: 2.0, r: 12.3, t: -27 }, { a: 324, d: 1.4, r: 12.9, t: 21 },
];
const RAYS = Array.from({ length: 16 }, (_, i) => ({ a: i * 22.5, len: i % 4 === 0 ? 34 : i % 2 === 0 ? 26 : 18 }));

/**
 * A sun that looks like one: a pale heart darkening to an orange limb, a rim of fire around it whose
 * edge slowly boils (blurred discs circling a little off-centre), long soft rays, and a wide bloom.
 */
function Sun({ alt }: { alt: number }) {
  const c = sunTint(alt);
  const high = Math.min(1, Math.max(0, (alt - 3) / 20)); // rays and bloom fade out as the sun gets low
  return (
    <g className="sky-sun">
      <defs>
        <radialGradient id="sun-body" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={c.heart} />
          <stop offset=".46" stopColor={c.body} />
          <stop offset=".88" stopColor={c.limb} />
          <stop offset="1" stopColor={c.limb} stopOpacity=".0" />
        </radialGradient>
        <radialGradient id="sun-bloom">
          <stop offset="0" stopColor={c.glow} stopOpacity=".62" />
          <stop offset=".22" stopColor={c.glow} stopOpacity=".26" />
          <stop offset=".55" stopColor={c.glow} stopOpacity=".07" />
          <stop offset="1" stopColor={c.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="sun-ray" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={c.glow} stopOpacity=".55" />
          <stop offset="1" stopColor={c.glow} stopOpacity="0" />
        </linearGradient>
        <filter id="sun-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.5" /></filter>
        <filter id="sun-softer" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.6" /></filter>
      </defs>
      <circle r="78" fill="url(#sun-bloom)" className="bloom" />
      <g className="rays" opacity={0.12 + 0.34 * high} filter="url(#sun-soft)">
        {RAYS.map((r) => (
          <path key={r.a} d={`M14 -2.2 L${14 + r.len} 0 L14 2.2 Z`} fill="url(#sun-ray)" transform={`rotate(${r.a})`} />
        ))}
      </g>
      <circle r="16.5" fill={c.rim} opacity=".5" filter="url(#sun-softer)" />
      <g filter="url(#sun-soft)">
        {BOIL.map((b, i) => (
          <g key={i} transform={`rotate(${b.a})`}>
            <g className="boil" style={{ animationDuration: `${Math.abs(b.t)}s`, animationDirection: b.t < 0 ? 'reverse' : 'normal' }}>
              <circle cx={b.d} r={b.r} fill={c.limb} />
            </g>
          </g>
        ))}
      </g>
      <circle r="12.4" fill="url(#sun-body)" />
      <circle r="5.5" fill={c.heart} opacity=".55" filter="url(#sun-soft)" />
    </g>
  );
}

export function SkyView({ times, now, place, nextKey }: { times: Record<PrayerKey, Date>; now: Date; place: { lat: number; lon: number }; nextKey: PrayerKey | null }) {
  const dayKey = times.dhuhr.getTime();
  const scene = useMemo(() => {
    // the sun's path from a little before fajr to a little after ʿishāʾ, azimuth unwrapped so it never jumps
    const from = times.fajr.getTime() - 50 * 60000;
    const to = times.isha.getTime() + 50 * 60000;
    const pts: { t: number; az: number; alt: number }[] = [];
    let prev: number | null = null;
    for (let t = from; t <= to; t += 6 * 60000) {
      const p = sunPosition(new Date(t), place);
      let az = p.az;
      if (prev !== null) { while (az - prev > 180) az -= 360; while (az - prev < -180) az += 360; }
      prev = az;
      pts.push({ t, az, alt: p.alt });
    }
    const azs = pts.map((p) => p.az);
    const lo = Math.min(...azs), hi = Math.max(...azs);
    const pad = (hi - lo) * 0.05 + 4;
    const altTop = Math.max(Math.max(...pts.map((p) => p.alt)) + 14, 42);
    return { pts, azMin: lo - pad, azMax: hi + pad, altTop };
  }, [dayKey, place.lat, place.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const { pts, azMin, azMax, altTop } = scene;
  const X = (az: number) => ((az - azMin) / (azMax - azMin)) * W;
  const Y = (alt: number) => ((altTop - alt) / (altTop - ALT_BOTTOM)) * H;
  const yH = Y(0);
  /** A position on the path by time (interpolated between samples), so beads and the sun sit exactly on the line. */
  const onPath = (time: number) => {
    const i = Math.min(pts.length - 2, Math.max(0, Math.floor((time - pts[0].t) / (6 * 60000))));
    const a = pts[i], b = pts[i + 1];
    const f = Math.min(1, Math.max(0, (time - a.t) / (b.t - a.t)));
    return { x: X(a.az + (b.az - a.az) * f), y: Y(a.alt + (b.alt - a.alt) * f), alt: a.alt + (b.alt - a.alt) * f };
  };
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.az).toFixed(1)} ${Y(p.alt).toFixed(1)}`).join(' ');
  /** How far along the drawn line (0 … 1 of its length) a moment is: the shine runs from the line's start to the sun. */
  const along = (time: number) => {
    let total = 0, upTo = 0;
    const target = onPath(time);
    for (let i = 1; i < pts.length; i++) {
      const dx = X(pts[i].az) - X(pts[i - 1].az), dy = Y(pts[i].alt) - Y(pts[i - 1].alt);
      const seg = Math.hypot(dx, dy);
      if (pts[i].t <= time) upTo += seg;
      else if (pts[i - 1].t < time) upTo += Math.hypot(target.x - X(pts[i - 1].az), target.y - Y(pts[i - 1].alt));
      total += seg;
    }
    return { total, upTo };
  };
  const inWindow = now.getTime() >= pts[0].t && now.getTime() <= pts[pts.length - 1].t;
  const sun = inWindow ? onPath(now.getTime()) : null;
  const tint = sunTint(sun?.alt ?? 30);
  const run = sun ? along(now.getTime()) : { total: 0, upTo: 0 };
  const horizonGlow = sun ? Math.max(0, 1 - Math.abs(sun.alt - 1) / 11) : 0;

  const moon = moonState(now, place);
  const mid = (azMin + azMax) / 2;
  let maz = moon.az;
  while (maz - mid > 180) maz -= 360;
  while (maz - mid < -180) maz += 360;
  const moonUp = moon.alt > -3 && maz > azMin - 4 && maz < azMax + 4;
  const south = place.lat < 0;

  return (
    <svg className={`amb-sky-view${sun && sun.alt > -1 ? '' : ' is-night'}`} viewBox={`0 0 ${W} ${H}`} aria-hidden focusable="false">
      <defs>
        <clipPath id="sky-above"><rect x="-40" y="-60" width={W + 80} height={yH + 60} /></clipPath>
        <linearGradient id="sky-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".52" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sky-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e6c982" stopOpacity="0" />
          <stop offset=".12" stopColor="#e6c982" stopOpacity=".55" />
          <stop offset=".88" stopColor="#e6c982" stopOpacity=".55" />
          <stop offset="1" stopColor="#e6c982" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="sky-sides" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".16" stopColor="#fff" stopOpacity="1" />
          <stop offset=".84" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="sky-fade"><rect x="0" y="-60" width={W} height={H + 120} fill="url(#sky-sides)" /></mask>
        <radialGradient id="sky-horizon-glow">
          <stop offset="0" stopColor={tint.glow} stopOpacity=".6" />
          <stop offset="1" stopColor={tint.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* the whole path faintly (the part under the ground is where the sun is before sunrise and after sunset) */}
      <path d={path} className="sky-path under" />
      <g clipPath="url(#sky-above)">
        <path d={path} className="sky-path" />
        {sun && sun.alt > 0 && (
          <g className="sky-shine" style={{ '--to': `${(-run.upTo).toFixed(1)}px`, '--gap': `${(run.total * 2).toFixed(0)}px` } as React.CSSProperties}>
            <path d={path} className="tail" />
            <path d={path} className="head" />
          </g>
        )}
        {moonUp && (
          <g transform={`translate(${X(maz).toFixed(1)} ${Y(moon.alt).toFixed(1)})`}>
            <MoonDisc r={9} lit={moon.lit} waxing={moon.waxing} south={south} id="sky-moon" />
          </g>
        )}
        {sun && (
          <g transform={`translate(${sun.x.toFixed(1)} ${sun.y.toFixed(1)})`}>
            <Sun alt={sun.alt} />
          </g>
        )}
      </g>
      {sun && horizonGlow > 0 && <ellipse cx={sun.x} cy={yH} rx="120" ry="20" fill="url(#sky-horizon-glow)" opacity={horizonGlow} />}

      {/* the ground, a small skyline, and the horizon */}
      <g mask="url(#sky-fade)"><rect x="0" y={yH} width={W} height={H - yH} fill="url(#sky-ground)" /></g>
      <path className="sky-city" transform={`translate(135 ${yH.toFixed(1)})`} d="M0 0v-5h14v-3h10v3h12v-7h4v-10l2.5-5 2.5 5v10h6v-4q13-17 26 0v4h6v-10l2.5-5 2.5 5v10h4v7h14v-4h12v4h16v5z" />
      <line x1="0" y1={yH} x2={W} y2={yH} stroke="url(#sky-line)" strokeWidth="1" />

      {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerKey[]).map((k) => {
        const p = onPath(times[k].getTime());
        const past = times[k].getTime() <= now.getTime();
        return <circle key={k} cx={p.x} cy={p.y} r={k === 'sunrise' ? 1.6 : k === nextKey ? 3.6 : 2.6} className={`sky-bead${k === nextKey ? ' next' : ''}${past ? ' past' : ''}${p.alt < -2 ? ' below' : ''}${k === 'sunrise' ? ' minor' : ''}`} />;
      })}
    </svg>
  );
}
