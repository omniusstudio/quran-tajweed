// Prayer times from the sun's position (the standard astronomical formulas; no dependencies, so
// the app and the local server share this file). Times come back as Date objects.
//
//   prayerTimes(new Date(), { lat: 15.5, lon: 32.56 }, { method: 'egypt', asr: 'standard' })
//   → { fajr, sunrise, dhuhr, asr, maghrib, isha }

export const METHODS = {
  mwl: { name: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
  egypt: { name: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
  makkah: { name: 'أم القرى (مكة المكرمة)', fajr: 18.5, ishaMinutes: 90 },
  karachi: { name: 'جامعة العلوم الإسلامية، كراتشي', fajr: 18, isha: 18 },
  isna: { name: 'أمريكا الشمالية (ISNA)', fajr: 15, isha: 15 },
  france: { name: 'اتحاد المنظمات الإسلامية في فرنسا', fajr: 12, isha: 12 },
  turkey: { name: 'رئاسة الشؤون الدينية، تركيا', fajr: 18, isha: 17 },
};
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PRAYER_NAMES = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const fix = (a, n) => a - n * Math.floor(a / n);

/** Sun declination (degrees) and equation of time (hours) for a Julian date. */
function sun(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - RA };
}

function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

/**
 * Times for the calendar day of `date` (its local year/month/day) at a place.
 * opts: { method, asr: 'standard' | 'hanafi', adjust: { fajr: minutes, … } }
 */
export function prayerTimes(date, place, opts = {}) {
  const m = METHODS[opts.method] || METHODS.mwl;
  const { lat, lon } = place;
  const y = date.getFullYear(), mo = date.getMonth() + 1, d = date.getDate();
  const jd0 = julian(y, mo, d) - lon / (15 * 24);
  const midnightUTC = Date.UTC(y, mo - 1, d);

  // hours in UTC for the day, refined once with the sun's position at that moment
  const noon = (t) => fix(12 - sun(jd0 + t / 24).eqt, 24) - lon / 15;
  const angleTime = (angle, t, dir) => {
    const s = sun(jd0 + t / 24);
    const x = (-Math.sin(rad(angle)) - Math.sin(rad(s.decl)) * Math.sin(rad(lat))) / (Math.cos(rad(s.decl)) * Math.cos(rad(lat)));
    if (x < -1 || x > 1) return NaN; // the sun never reaches that angle (high latitudes)
    return noon(t) + (dir * deg(Math.acos(x))) / 15;
  };
  const asrTime = (factor, t) => {
    const s = sun(jd0 + t / 24);
    const angle = -deg(Math.atan(1 / (factor + Math.tan(rad(Math.abs(lat - s.decl))))));
    return angleTime(angle, t, 1);
  };
  const local = (h) => h + lon / 15; // initial guesses are given in local solar hours
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let i = 0; i < 2; i++) {
    const g = (k) => (i === 0 ? t[k] : local(t[k]));
    t = {
      fajr: angleTime(m.fajr, g('fajr'), -1),
      sunrise: angleTime(0.833, g('sunrise'), -1),
      dhuhr: noon(g('dhuhr')),
      asr: asrTime(opts.asr === 'hanafi' ? 2 : 1, g('asr')),
      maghrib: angleTime(0.833, g('maghrib'), 1),
      isha: m.ishaMinutes ? NaN : angleTime(m.isha, g('isha'), 1),
    };
  }
  if (m.ishaMinutes) t.isha = t.maghrib + m.ishaMinutes / 60;
  // high latitudes: keep fajr / isha inside the night by the "middle of the night" rule
  const night = 24 - (t.maghrib - t.sunrise);
  if (Number.isNaN(t.fajr) || t.sunrise - t.fajr > night / 2) t.fajr = t.sunrise - night / 2;
  if (Number.isNaN(t.isha) || t.isha - t.maghrib > night / 2) t.isha = t.maghrib + night / 2;
  const out = {};
  for (const k of Object.keys(t)) {
    const adj = (opts.adjust && opts.adjust[k]) || 0;
    out[k] = new Date(Math.round((midnightUTC + t[k] * 3600000 + adj * 60000) / 60000) * 60000);
  }
  return out;
}

// ---- where the sun and the moon are in the sky (for the ambient screen's sky view) ----
const J2000 = 2451545.0;
const jdOf = (date) => date.getTime() / 86400000 + 2440587.5;

/** Equatorial → horizontal. RA and Dec in degrees; returns { az (from north, clockwise), alt } in degrees. */
function horizontal(ra, dec, jd, place) {
  const d = jd - J2000;
  const lst = fix(280.46061837 + 360.98564736629 * d + place.lon, 360);
  const H = rad(fix(lst - ra + 180, 360) - 180);
  const phi = rad(place.lat), de = rad(dec);
  const alt = Math.asin(Math.sin(phi) * Math.sin(de) + Math.cos(phi) * Math.cos(de) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(de) * Math.cos(phi)) + Math.PI;
  return { az: fix(deg(az), 360), alt: deg(alt) };
}

/** Ecliptic longitude/latitude (degrees) → RA/Dec (degrees). */
function equatorial(lambda, beta, jd) {
  const e = rad(23.439 - 0.00000036 * (jd - J2000));
  const l = rad(lambda), b = rad(beta);
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  return { ra: fix(deg(ra), 360), dec: deg(dec) };
}

function sunLongitude(jd) {
  const D = jd - J2000;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  return fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360);
}

/** The sun in the sky of a place at an instant: { az, alt } in degrees (no refraction). */
export function sunPosition(date, place) {
  const jd = jdOf(date);
  const { ra, dec } = equatorial(sunLongitude(jd), 0, jd);
  return horizontal(ra, dec, jd, place);
}

/** Low-precision lunar theory (Astronomical Almanac): ecliptic longitude and latitude, good to about half a degree. */
function moonEcliptic(jd) {
  const T = (jd - J2000) / 36525;
  const s = (a, b) => Math.sin(rad(a + b * T));
  const lambda = 218.32 + 481267.881 * T + 6.29 * s(135.0, 477198.87) - 1.27 * s(259.3, -413335.36) + 0.66 * s(235.7, 890534.22) + 0.21 * s(269.9, 954397.74) - 0.19 * s(357.5, 35999.05) - 0.11 * s(186.5, 966404.03);
  const beta = 5.13 * s(93.3, 483202.02) + 0.28 * s(228.2, 960400.89) - 0.28 * s(318.3, 6003.15) - 0.17 * s(217.6, -407332.21);
  return { lambda: fix(lambda, 360), beta };
}

/**
 * The moon at an instant: where it is in the sky of a place, how much of it is lit (0 new … 1 full),
 * and whether it is waxing. `age` is days since the new moon.
 */
export function moonState(date, place) {
  const jd = jdOf(date);
  const m = moonEcliptic(jd);
  const elong = fix(m.lambda - sunLongitude(jd), 360);
  const { ra, dec } = equatorial(m.lambda, m.beta, jd);
  return { ...horizontal(ra, dec, jd, place), lit: (1 - Math.cos(rad(elong))) / 2, waxing: elong < 180, age: (elong / 360) * 29.530588853 };
}

/** Minutes east of UTC for an IANA zone at an instant. */
export function tzOffsetMinutes(tz, at = new Date()) {
  const p = new Intl.DateTimeFormat('en-US-u-nu-latn', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at);
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - at.getTime()) / 60000);
}

export const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * The zone a place's times are shown in: the one stored with the place; else the device's zone when
 * the place is near the device's own meridian ("here"); else the whole-hour zone of its longitude.
 */
export function placeTz(place, at = new Date()) {
  if (!place) return deviceTz();
  if (place.tz) return place.tz;
  const solar = place.lon / 15;
  if (Math.abs(tzOffsetMinutes(deviceTz(), at) / 60 - solar) <= 2.5) return deviceTz();
  const h = Math.round(solar);
  return h === 0 ? 'Etc/UTC' : `Etc/GMT${h > 0 ? '-' : '+'}${Math.abs(h)}`; // POSIX sign: Etc/GMT-2 is UTC+2
}

/** The calendar day it is at the place, as a Date whose local fields carry that day. */
export function placeDay(at, tz, addDays = 0) {
  const p = new Intl.DateTimeFormat('en-US-u-nu-latn', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(at);
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return new Date(g('year'), g('month') - 1, g('day') + addDays);
}

/** Today's times at the place (its own calendar day, wherever the device is). */
export function timesAt(now, place, opts) {
  return prayerTimes(placeDay(now, placeTz(place, now)), place, opts);
}

/** The next prayer after `now`: { key, at } (looks into tomorrow after ʿishāʾ). */
export function nextPrayer(now, place, opts) {
  const tz = placeTz(place, now);
  for (let add = 0; add < 2; add++) {
    const t = prayerTimes(placeDay(now, tz, add), place, opts);
    for (const k of PRAYERS) if (t[k] > now) return { key: k, at: t[k] };
  }
  return null;
}
