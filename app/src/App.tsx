import { useEffect, useState } from 'react';
import { RULES } from './content/lessons';
import { DictionaryPage } from './pages/DictionaryPage';
import { LessonScreen, LessonsIndex } from './pages/LessonsPage';
import { ContrastPage, LettersPage } from './pages/LettersPage';
import { ChecklistPage } from './pages/ChecklistPage';
import { ReferencePage } from './pages/ReferencePage';
import { DrillsPage } from './pages/DrillsPage';
import { FollowPage } from './pages/FollowPage';
import { AlignPage } from './pages/AlignPage';
import { RecorderPage } from './pages/RecorderPage';
import { ExercisesPage, EXERCISES, type ExerciseKind } from './pages/ExercisesPage';
import { GoalRing, HomePage } from './pages/HomePage';
import { readProgress, recentDays, streak, useProgress } from './content/progress';
import { arNum } from './pages/shared';
import { PracticePage } from './pages/PracticePage';
import { SettingsPage } from './pages/SettingsPage';
import { HifzPage } from './pages/HifzPage';
import { SURAH_BY_NUMBER } from './audio/quran';
import { BY_ID, CONTRAST_PAIRS } from './viewer/articulations';
import { Celebrations } from './ui/celebrate';
import { Icon, type IconName } from './ui/icons';
import { Mark } from './ui/Mark';
import { isDark, useSettings } from './ui/settings';
import { primeSound, sfx } from './ui/sound';

type Route =
  | { tab: 'home' }
  | { tab: 'practice' }
  | { tab: 'settings' }
  | { tab: 'hifz' }
  | { tab: 'lessons'; id?: string }
  | { tab: 'letters'; id: string }
  | { tab: 'contrast'; id: string }
  | { tab: 'dictionary'; id?: string }
  | { tab: 'follow'; surah: number; verse?: number }
  | { tab: 'align'; surah: number }
  | { tab: 'recorder' }
  | { tab: 'exercises'; kind?: ExerciseKind; param?: string }
  | { tab: 'reference'; id?: string }
  | { tab: 'drills'; id?: string }
  | { tab: 'checklist' };

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [tab, id, extra] = h.split('/');
  if (!tab || tab === 'home') return { tab: 'home' };
  if (tab === 'practice') return { tab: 'practice' };
  if (tab === 'settings') return { tab: 'settings' };
  if (tab === 'hifz') return { tab: 'hifz' };
  if (tab === 'letters') return { tab: 'letters', id: id && BY_ID[id] ? id : 'qaf' };
  if (tab === 'contrast') return { tab: 'contrast', id: id && CONTRAST_PAIRS.some((p) => p.id === id) ? id : CONTRAST_PAIRS[0].id };
  if (tab === 'dictionary') return { tab: 'dictionary', id: id && RULES[id] ? id : undefined };
  if (tab === 'follow') return { tab: 'follow', surah: SURAH_BY_NUMBER[Number(id)] ? Number(id) : 1, verse: extra ? Number(extra) : undefined };
  if (tab === 'align') return { tab: 'align', surah: SURAH_BY_NUMBER[Number(id)] ? Number(id) : 1 };
  if (tab === 'recorder') return { tab: 'recorder' };
  if (tab === 'exercises') return { tab: 'exercises', kind: EXERCISES.some((e) => e.kind === id) ? (id as ExerciseKind) : undefined, param: extra };
  if (tab === 'reference') return { tab: 'reference', id };
  if (tab === 'drills') return { tab: 'drills', id };
  if (tab === 'checklist') return { tab: 'checklist' };
  return { tab: 'lessons', id: id && RULES[id] ? id : undefined };
}

function useRoute(): [Route, (hash: string) => void] {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const go = (hash: string) => {
    if (location.hash === hash) setRoute(parseHash());
    else location.hash = hash;
  };
  return [route, go];
}

interface NavItem {
  tab: Route['tab'];
  label: string;
  hash: string;
  icon: IconName;
  /** Routes this item counts as "current" for. */
  covers?: Route['tab'][];
  hint?: string;
}

const NAV: NavItem[] = [
  { tab: 'home', label: 'الرئيسية', hash: '#/', icon: 'home' },
  { tab: 'lessons', label: 'الدروس', hash: '#/lessons', icon: 'book', covers: ['lessons', 'dictionary'] },
  { tab: 'letters', label: 'الحروف', hash: '#/letters/qaf', icon: 'face', covers: ['letters'] },
  { tab: 'practice', label: 'التدريب', hash: '#/practice', icon: 'target', covers: ['practice', 'exercises', 'drills', 'follow', 'contrast', 'hifz'] },
];
const MORE: NavItem[] = [
  { tab: 'hifz', label: 'تحدي الحفظ', hash: '#/hifz', icon: 'star', hint: 'خمس آيات كل يوم، والمراجعة في وقتها' },
  { tab: 'reference', label: 'المرجع', hash: '#/reference', icon: 'library', hint: 'الدوري وحفص، الأصول والفرش' },
  { tab: 'dictionary', label: 'القاموس', hash: '#/dictionary', icon: 'dictionary', hint: 'كل مصطلح بتعريف بسيط' },
  { tab: 'contrast', label: 'هذا، لا ذاك', hash: '#/contrast', icon: 'split', hint: 'الأزواج المتشابهة جنباً إلى جنب' },
  { tab: 'settings', label: 'الإعدادات', hash: '#/settings', icon: 'sliders', hint: 'السمة، الأصوات، حجم النص، الهدف' },
  { tab: 'align', label: 'المحاذاة', hash: '#/align/1', icon: 'align', hint: 'أداة المطوّر: حدود الآيات والكلمات' },
  { tab: 'recorder', label: 'تسجيل المعلم', hash: '#/recorder', icon: 'mic', hint: 'أداة المطوّر: مقاطع الحروف' },
  { tab: 'checklist', label: 'الجاهزية', hash: '#/checklist', icon: 'clipboard', hint: 'أداة المطوّر: ما اكتمل وما لم يكتمل' },
];
const MORE_TABS = new Set<Route['tab']>(['reference', 'dictionary', 'settings', 'align', 'recorder', 'checklist']);

export default function App() {
  const [route, go] = useRoute();
  const [more, setMore] = useState(false);
  const [settings, update] = useSettings();
  const dark = isDark(settings);

  useEffect(() => {
    setMore(false);
    // Move focus to the main region after navigation so screen readers land on the new content.
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [route]);
  useEffect(() => {
    const prime = () => primeSound();
    addEventListener('pointerdown', prime, { once: true });
    return () => removeEventListener('pointerdown', prime);
  }, []);
  useEffect(() => {
    if (!more) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMore(false);
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [more]);

  const isCurrent = (n: NavItem) => (n.covers ?? [n.tab]).includes(route.tab);
  const [progress] = useProgress();
  void progress; // re-render the sidebar widget when progress changes
  const p = readProgress();
  const todayPts = recentDays(p, 1)[0].points;
  const st = streak(p);
  const nav = (hash: string) => {
    sfx('tap');
    go(hash);
  };
  const toggleTheme = () => {
    update({ theme: dark ? 'light' : 'dark' });
    sfx('toggle');
  };

  return (
    <div className="app">
      <aside className="sidebar" aria-label="التنقل">
        <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); nav('#/'); }}>
          <span className="logo" aria-hidden><Mark size={40} /></span>
          <h1>
            نُطق
            <small>رواية الدوري عن أبي عمرو</small>
          </h1>
        </a>
        <nav className="side-nav">
          {NAV.map((n) => (
            <button key={n.tab} aria-current={isCurrent(n) ? 'page' : undefined} onClick={() => nav(n.hash)}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </button>
          ))}
          <span className="group-title">المزيد</span>
          {MORE.filter((n) => n.tab !== 'settings').map((n) => (
            <button key={n.tab} aria-current={route.tab === n.tab ? 'page' : undefined} onClick={() => nav(n.hash)}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="side-goal" onClick={() => nav('#/')} aria-label="هدف اليوم">
            <GoalRing value={todayPts} goal={settings.dailyGoal} size={56} />
            <span>
              <strong>{todayPts >= settings.dailyGoal ? 'أنجزت هدف اليوم' : `${arNum(todayPts)} من ${arNum(settings.dailyGoal)} اليوم`}</strong>
              <small>{st > 0 ? `${arNum(st)} ${st === 1 ? 'يوم' : st === 2 ? 'يومان' : st <= 10 ? 'أيام' : 'يوماً'} متتالية` : 'ابدأ سلسلتك اليوم'}</small>
            </span>
          </button>
          <div className="side-actions">
            <button className="icon-btn" onClick={toggleTheme} aria-label={dark ? 'الوضع الفاتح' : 'الوضع الداكن'} title={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}>
              <Icon name={dark ? 'sun' : 'moon'} />
            </button>
            <button className="icon-btn" aria-pressed={route.tab === 'settings'} onClick={() => nav('#/settings')} aria-label="الإعدادات" title="الإعدادات">
              <Icon name="sliders" />
            </button>
          </div>
        </div>
      </aside>
      <header className="app-header">
        <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); nav('#/'); }}>
          <span className="logo" aria-hidden><Mark size={32} /></span>
          <h1>نُطق</h1>
        </a>
        <span className="sub">تعلّم نطق القرآن — رواية الدوري عن أبي عمرو</span>
        <span className="spacer" />
        <nav className="nav" aria-label="التنقل الرئيسي">
          {NAV.map((n) => (
            <button key={n.tab} aria-current={isCurrent(n) ? 'page' : undefined} onClick={() => nav(n.hash)}>
              <Icon name={n.icon} />
              <span>{n.label}</span>
            </button>
          ))}
          <button aria-current={MORE_TABS.has(route.tab) ? 'page' : undefined} aria-expanded={more} aria-haspopup="dialog" onClick={() => { setMore((m) => !m); sfx('tap'); }}>
            <Icon name="more" />
            <span>المزيد</span>
          </button>
        </nav>
        <div className="actions">
          <button className="icon-btn" onClick={toggleTheme} aria-label={dark ? 'الوضع الفاتح' : 'الوضع الداكن'} title={dark ? 'الوضع الفاتح' : 'الوضع الداكن'}>
            <Icon name={dark ? 'sun' : 'moon'} />
          </button>
          <button className="icon-btn" aria-pressed={route.tab === 'settings'} onClick={() => nav('#/settings')} aria-label="الإعدادات" title="الإعدادات">
            <Icon name="sliders" />
          </button>
        </div>
      </header>

      {more && (
        <>
          <div className="sheet-backdrop" onClick={() => setMore(false)} />
          <div className="sheet" role="dialog" aria-label="المزيد">
            <div className="grip" aria-hidden />
            <h2>المزيد</h2>
            <div className="sheet-list">
              {MORE.map((n) => (
                <button key={n.tab} className="sheet-item" aria-current={route.tab === n.tab ? 'page' : undefined} onClick={() => nav(n.hash)}>
                  <Icon name={n.icon} />
                  <span>
                    {n.label}
                    {n.hint && <small>{n.hint}</small>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <main id="main" className="app-main" tabIndex={-1}>
        {route.tab === 'home' && <HomePage go={go} />}
        {route.tab === 'practice' && <PracticePage go={go} />}
        {route.tab === 'settings' && <SettingsPage go={go} />}
        {route.tab === 'hifz' && <HifzPage go={go} />}
        {route.tab === 'lessons' && (route.id ? <LessonScreen ruleId={route.id} go={go} /> : <LessonsIndex go={go} />)}
        {route.tab === 'letters' && <LettersPage id={route.id} go={go} />}
        {route.tab === 'contrast' && <ContrastPage id={route.id} go={go} />}
        {route.tab === 'dictionary' && <DictionaryPage termId={route.id} go={go} />}
        {route.tab === 'follow' && <FollowPage key={route.surah} surah={route.surah} verse={route.verse} go={go} />}
        {route.tab === 'align' && <AlignPage key={route.surah} surah={route.surah} go={go} />}
        {route.tab === 'recorder' && <RecorderPage />}
        {route.tab === 'exercises' && <ExercisesPage key={`${route.kind}-${route.param}`} kind={route.kind} param={route.param} go={go} />}
        {route.tab === 'reference' && <ReferencePage sectionId={route.id} go={go} />}
        {route.tab === 'drills' && <DrillsPage drillId={route.id} go={go} />}
        {route.tab === 'checklist' && <ChecklistPage />}
      </main>
      <Celebrations />
    </div>
  );
}
