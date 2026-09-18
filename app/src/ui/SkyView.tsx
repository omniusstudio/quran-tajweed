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
      </defs>
      {halo && <circle r={r * 3.4} fill={`url(#${id}-halo)`} />}
      <circle r={r} fill="#0b1422" opacity=".55" />
      <circle r={r} fill="#cdd6e6" opacity=".10" />
      <g clipPath={`url(#${id}-clip)`}>
        <circle r={r} fill={`url(#${id}-lit)`} />
        <g fill="#8d8a7c" opacity=".26">
          <circle cx={-r * 0.3} cy={-r * 0.32} r={r * 0.2} />
          <circle cx={r * 0.26} cy={-r * 0.05} r={r * 0.27} />
          <circle cx={-r * 0.12} cy={r * 0.42} r={r * 0.16} />
          <circle cx={r * 0.46} cy={r * 0.46} r={r * 0.11} />
          <circle cx={-r * 0.52} cy={r * 0.1} r={r * 0.1} />
        </g>
      </g>
    </g>
  );
}

function sunTint(alt: number) {
  if (alt < 6) return { core: '#ffe2bd', edge: '#ff9b52', glow: '#ff7e3d' };
  if (alt < 22) return { core: '#fff1cc', edge: '#ffc267', glow: '#ffae4a' };
  return { core: '#fffbea', edge: '#ffe08a', glow: '#ffd36b' };
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
  const inWindow = now.getTime() >= pts[0].t && now.getTime() <= pts[pts.length - 1].t;
  const sun = inWindow ? onPath(now.getTime()) : null;
  const tint = sunTint(sun?.alt ?? 30);
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
        <radialGradient id="sky-sun-core">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".55" stopColor={tint.core} />
          <stop offset="1" stopColor={tint.edge} />
        </radialGradient>
        <radialGradient id="sky-sun-halo">
          <stop offset="0" stopColor={tint.glow} stopOpacity=".55" />
          <stop offset=".35" stopColor={tint.glow} stopOpacity=".18" />
          <stop offset="1" stopColor={tint.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sky-horizon-glow">
          <stop offset="0" stopColor={tint.glow} stopOpacity=".6" />
          <stop offset="1" stopColor={tint.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* the whole path faintly (the part under the ground is where the sun is before sunrise and after sunset) */}
      <path d={path} className="sky-path under" />
      <g clipPath="url(#sky-above)">
        <path d={path} className="sky-path" />
        {moonUp && (
          <g transform={`translate(${X(maz).toFixed(1)} ${Y(moon.alt).toFixed(1)})`}>
            <MoonDisc r={9} lit={moon.lit} waxing={moon.waxing} south={south} id="sky-moon" />
          </g>
        )}
        {sun && (
          <g transform={`translate(${sun.x.toFixed(1)} ${sun.y.toFixed(1)})`} className="sky-sun">
            <circle r="46" fill="url(#sky-sun-halo)" className="halo" />
            <circle r="9.5" fill="url(#sky-sun-core)" />
          </g>
        )}
      </g>
      {sun && horizonGlow > 0 && <ellipse cx={sun.x} cy={yH} rx="92" ry="17" fill="url(#sky-horizon-glow)" opacity={horizonGlow} />}

      {/* the ground, a small skyline, and the horizon */}
      <g mask="url(#sky-fade)"><rect x="0" y={yH} width={W} height={H - yH} fill="url(#sky-ground)" /></g>
      <path className="sky-city" transform={`translate(135 ${yH.toFixed(1)})`} d="M0 0v-5h14v-3h10v3h12v-7h4v-10l2.5-5 2.5 5v10h6v-4q13-17 26 0v4h6v-10l2.5-5 2.5 5v10h4v7h14v-4h12v4h16v5z" />
      <line x1="0" y1={yH} x2={W} y2={yH} stroke="url(#sky-line)" strokeWidth="1" />

      {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerKey[]).map((k) => {
        const p = onPath(times[k].getTime());
        const past = times[k].getTime() <= now.getTime();
        return <circle key={k} cx={p.x} cy={p.y} r={k === 'sunrise' ? 2 : k === nextKey ? 5 : 3.2} className={`sky-bead${k === nextKey ? ' next' : ''}${past ? ' past' : ''}${p.alt < -2 ? ' below' : ''}${k === 'sunrise' ? ' minor' : ''}`} />;
      })}
    </svg>
  );
}
