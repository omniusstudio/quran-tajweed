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

/** The next prayer after `now`: { key, at } (looks into tomorrow after ʿishāʾ). */
export function nextPrayer(now, place, opts) {
  for (let add = 0; add < 2; add++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + add);
    const t = prayerTimes(day, place, opts);
    for (const k of PRAYERS) if (t[k] > now) return { key: k, at: t[k] };
  }
  return null;
}
