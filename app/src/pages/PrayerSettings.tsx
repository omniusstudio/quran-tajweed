import { useEffect, useRef, useState } from 'react';
import { CITIES } from '../content/cities';
import { DEVICE_TZ, METHODS, PRAYERS, PRAYER_NAMES, clock, placeTz, suggestMethod, timesFor, tzOffsetMinutes, type PrayerKey } from '../content/prayer';
import { AdhanPlay } from '../ui/AdhanPlay';
import { Icon } from '../ui/icons';
import { useSettings } from '../ui/settings';
import { sfx } from '../ui/sound';

interface AdhanStatus {
  mac: boolean;
  files: { adhan: boolean; fajr: boolean };
  enabled: boolean;
  playing: boolean;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => { onChange(!checked); sfx('toggle'); }} />;
}

/** Settings → prayer times and the adhān: place, method, which prayers, and the learner's own recording. */
export function PrayerSettings() {
  const [s, update] = useSettings();
  const [status, setStatus] = useState<AdhanStatus | null | 'none'>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [lat, setLat] = useState(s.place ? String(s.place.lat) : '');
  const [lon, setLon] = useState(s.place ? String(s.place.lon) : '');
  const fileInput = useRef<HTMLInputElement | null>(null);
  const slotRef = useRef<'adhan' | 'fajr'>('adhan');
  const refresh = () => fetch('/__adhan', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())).then((j: AdhanStatus) => setStatus(j)).catch(() => setStatus('none'));
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (s.place) { setLat(String(s.place.lat)); setLon(String(s.place.lon)); } }, [s.place]);

  const adhan = s.adhan ?? { enabled: false, prayers: {} };
  const times = timesFor(new Date(), s);
  const locate = () => {
    if (!('geolocation' in navigator)) return setMsg('هذا المتصفح لا يتيح تحديد الموقع. أدخل الإحداثيات يدوياً.');
    setBusy(true);
    setMsg('جارٍ تحديد الموقع…');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const la = Number(p.coords.latitude.toFixed(4)), lo = Number(p.coords.longitude.toFixed(4));
        update({ place: { lat: la, lon: lo, tz: DEVICE_TZ }, ...(s.place ? {} : { prayerMethod: suggestMethod(la, lo) }) });
        setBusy(false);
        setMsg('تم. الموقع محفوظ على أجهزتك فقط.');
      },
      () => {
        setBusy(false);
        setMsg('تعذّر تحديد الموقع (يعمل على هذا الجهاز أو عبر https فقط). أدخل خط العرض والطول يدوياً.');
      },
      { timeout: 15000, maximumAge: 3600000 },
    );
  };
  const saveManual = () => {
    const la = Number(lat), lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 66 || Math.abs(lo) > 180) return setMsg('أدخل خط عرض بين −66 و66 وخط طول بين −180 و180.');
    update({ place: { lat: la, lon: lo }, prayerMethod: suggestMethod(la, lo) });
    setMsg('تم حفظ الموقع. تأكد من المنطقة الزمنية أدناه إن كان المكان بعيداً عن مكان جهازك.');
    sfx('toggle');
  };
  const upload = async (file: File) => {
    setBusy(true);
    setMsg('جارٍ الرفع…');
    try {
      const r = await fetch(`/__adhan/file?slot=${slotRef.current}`, { method: 'PUT', headers: { 'content-type': file.type || 'audio/mpeg' }, body: file });
      const j = (await r.json()) as AdhanStatus & { error?: string };
      if (!r.ok) throw new Error(j.error || String(r.status));
      setStatus(j);
      setMsg('تم حفظ التسجيل على جهاز الماك.');
    } catch (e) {
      setMsg(`تعذّر الرفع: ${String((e as Error).message)}`);
    }
    setBusy(false);
  };
  const post = (path: string) => fetch(path, { method: 'POST' }).then((r) => r.json()).then((j: AdhanStatus & { played?: boolean }) => { setStatus(j); if (j.played === false) setMsg(j.files.adhan ? 'الأذان يُشغَّل على جهاز الماك فقط.' : 'ارفع تسجيل الأذان أولاً.'); }).catch(() => setMsg('الخادم المحلي غير متاح.'));
  const pick = (slot: 'adhan' | 'fajr') => { slotRef.current = slot; fileInput.current?.click(); };
  const remove = (slot: 'adhan' | 'fajr') => fetch(`/__adhan/file?slot=${slot}`, { method: 'DELETE' }).then((r) => r.json()).then((j: AdhanStatus) => setStatus(j)).catch(() => undefined);
  const st = status && status !== 'none' ? status : null;
  const tz = placeTz(s);
  const zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [DEVICE_TZ];
  const offsetLabel = (z: string) => { const m = tzOffsetMinutes(z); const sign = m < 0 ? '−' : '+'; return `UTC${sign}${Math.floor(Math.abs(m) / 60)}${Math.abs(m) % 60 ? ':' + String(Math.abs(m) % 60).padStart(2, '0') : ''}`; };
  const farFromDevice = !!s.place && Math.abs(tzOffsetMinutes(DEVICE_TZ) / 60 - s.place.lon / 15) > 2.5;
  const pickCity = (i: number) => {
    const c = CITIES[i];
    if (!c) return;
    update({ place: { lat: c.lat, lon: c.lon, name: `${c.name}، ${c.country}`, tz: c.tz }, prayerMethod: c.method });
    setMsg(`تم: ${c.name}.`);
    sfx('toggle');
  };

  return (
    <div className="card prayer-settings">
      <h3>الصلاة والأذان</h3>
      <div className="setting">
        <span className="label">
          <Icon name="mapPin" />
          <span>
            الموقع
            <small>{s.place ? `${s.place.name ? s.place.name + ' · ' : ''}خط العرض ${s.place.lat}، خط الطول ${s.place.lon}. تُحسب الأوقات على الجهاز نفسه.` : 'يلزم لحساب أوقات الصلاة. لا يُرسل إلى أي خادم خارجي.'}</small>
          </span>
        </span>
        <button className="toggle" onClick={locate} disabled={busy}><Icon name="mapPin" size={18} /> حدّد موقعي</button>
      </div>
      <div className="setting">
        <span className="label"><span>اختر مدينتك<small>أسرع طريقة: تُضبط الإحداثيات والمنطقة الزمنية وطريقة الحساب معاً</small></span></span>
        <select value={CITIES.findIndex((c) => s.place && c.lat === s.place.lat && c.lon === s.place.lon)} onChange={(e) => pickCity(Number(e.target.value))} aria-label="المدينة">
          <option value={-1}>— اختر —</option>
          {CITIES.map((c, i) => <option key={c.name} value={i}>{c.name}، {c.country}</option>)}
        </select>
      </div>
      <div className="setting manual-place">
        <span className="label"><span>أو يدوياً<small>من خرائط هاتفك: اضغط مطولاً على موقعك لترى الرقمين</small></span></span>
        <span className="row wrap">
          <input inputMode="decimal" dir="ltr" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="خط العرض" aria-label="خط العرض" />
          <input inputMode="decimal" dir="ltr" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="خط الطول" aria-label="خط الطول" />
          <button className="mini" onClick={saveManual}>حفظ</button>
        </span>
      </div>
      <div className="setting">
        <span className="label"><Icon name="sliders" /><span>طريقة الحساب<small>اختر المعتمدة في بلدك؛ الفرق في وقتي الفجر والعشاء</small></span></span>
        <select value={s.prayerMethod ?? 'mwl'} onChange={(e) => update({ prayerMethod: e.target.value })} aria-label="طريقة الحساب">
          {Object.entries(METHODS).map(([k, m]) => <option key={k} value={k}>{m.name}</option>)}
        </select>
      </div>
      <div className="setting">
        <span className="label"><Icon name="clock" /><span>وقت العصر<small>الجمهور: ظل الشيء مثله. الحنفية: مثلاه</small></span></span>
        <div className="segmented" role="group">
          <button aria-pressed={(s.asrMethod ?? 'standard') === 'standard'} onClick={() => update({ asrMethod: 'standard' })}>الجمهور</button>
          <button aria-pressed={s.asrMethod === 'hanafi'} onClick={() => update({ asrMethod: 'hanafi' })}>الحنفية</button>
        </div>
      </div>
      {s.place && (
        <div className="setting">
          <span className="label"><Icon name="clock" /><span>المنطقة الزمنية للمكان<small>تُعرض الأوقات بتوقيت المكان نفسه: {tz} ({offsetLabel(tz)})</small></span></span>
          <select value={tz} onChange={(e) => update({ place: { ...s.place!, tz: e.target.value } })} aria-label="المنطقة الزمنية" dir="ltr">
            {!zones.includes(tz) && <option value={tz}>{tz}</option>}
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      )}
      {farFromDevice && <p className="todo"><Icon name="alert" size={16} /> هذا المكان بعيد عن مكان جهازك ({DEVICE_TZ}). إن كنت تريد أوقات بلدك أنت فاختر مدينتك أو اضغط «حدّد موقعي».</p>}
      {times && (
        <div className="prayer-row">
          {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as PrayerKey[]).map((k) => <span key={k}><small>{PRAYER_NAMES[k]}</small>{clock(times[k])}</span>)}
        </div>
      )}

      <div className="setting">
        <span className="label">
          <Icon name={adhan.enabled ? 'bell' : 'bellOff'} />
          <span>
            الأذان عند دخول الوقت
            <small>يُرفع على جهاز الماك في كل وقت، والتطبيق مفتوح أو مغلق. على الهاتف يعمل والتطبيق مفتوح.</small>
          </span>
        </span>
        <Switch checked={adhan.enabled} label="الأذان" onChange={(v) => { update({ adhan: { ...adhan, enabled: v } }); if (v && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission(); }} />
      </div>
      {adhan.enabled && (
        <div className="setting">
          <span className="label"><span>أي الصلوات<small>أطفئ ما لا تريد أن يُؤذَّن له</small></span></span>
          <span className="chips prayer-chips">
            {(PRAYERS as string[]).map((k) => (
              <button key={k} className="chip small" aria-pressed={adhan.prayers?.[k] !== false} onClick={() => { update({ adhan: { ...adhan, prayers: { ...adhan.prayers, [k]: adhan.prayers?.[k] === false } } }); sfx('toggle'); }}>{PRAYER_NAMES[k]}</button>
            ))}
          </span>
        </div>
      )}
      {status === 'none' ? (
        <p className="ref">رفع تسجيل الأذان وتشغيله متاحان حين يُفتح التطبيق من الخادم المحلي على الماك.</p>
      ) : (
        <>
          <div className="setting">
            <span className="label">
              <Icon name="upload" />
              <span>
                تسجيل الأذان
                <small>{st?.files.adhan ? 'تسجيلك محفوظ. يمكنك استبداله.' : 'اختر ملف الأذان الذي تحبه من جهازك (mp3 أو m4a). بلا تسجيل يظهر إشعار فقط.'}</small>
              </span>
            </span>
            <span className="row wrap">
              <button className="toggle" onClick={() => pick('adhan')} disabled={busy}><Icon name="upload" size={18} /> {st?.files.adhan ? 'استبدل' : 'اختر الملف'}</button>
              {st?.files.adhan && <button className="mini" onClick={() => remove('adhan')}><Icon name="trash" size={14} /> احذف</button>}
            </span>
          </div>
          <div className="setting">
            <span className="label"><span>أذان الفجر (اختياري)<small>{st?.files.fajr ? 'محفوظ.' : 'تسجيل فيه «الصلاة خير من النوم». إن تُرك استُعمل التسجيل العام.'}</small></span></span>
            <span className="row wrap">
              <button className="mini" onClick={() => pick('fajr')} disabled={busy}><Icon name="upload" size={14} /> {st?.files.fajr ? 'استبدل' : 'اختر'}</button>
              {st?.files.fajr && <button className="mini" onClick={() => remove('fajr')}><Icon name="trash" size={14} /> احذف</button>}
            </span>
          </div>
          <div className="row wrap">
            <AdhanPlay label="شغّل الأذان هنا" />
            <button className="toggle" onClick={() => post('/__adhan/test?slot=adhan')} disabled={!st?.files.adhan || !st?.mac}><Icon name="volume" size={16} /> شغّله من سماعات الماك</button>
            <button className="mini" onClick={() => post('/__adhan/stop')}><Icon name="stop" size={14} /> أوقف</button>
            {st?.playing && <span className="badge">يُرفع الأذان الآن</span>}
          </div>
        </>
      )}
      <input ref={fileInput} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
      {msg && <p className="ref" role="status">{msg}</p>}

      <div className="setting">
        <span className="label"><Icon name="listChecks" /><span>تذكير مهام اليوم<small>إشعار إن بقي من قائمتك شيء. على الماك يصل والتطبيق مغلق.</small></span></span>
        <span className="row">
          <input type="time" value={s.todoReminder ?? ''} onChange={(e) => { update({ todoReminder: e.target.value || null }); if (e.target.value && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission(); }} aria-label="وقت التذكير" />
          {s.todoReminder && <button className="mini" onClick={() => update({ todoReminder: null })}>إلغاء</button>}
        </span>
      </div>
    </div>
  );
}
