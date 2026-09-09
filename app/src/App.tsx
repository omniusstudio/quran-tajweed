import { useEffect, useState } from 'react';
import { RULES } from './content/lessons';
import { DictionaryPage } from './pages/DictionaryPage';
import { LessonScreen, LessonsIndex } from './pages/LessonsPage';
import { ChecklistPage, ContrastPage, LettersPage } from './pages/LettersPage';
import { BY_ID, CONTRAST_PAIRS } from './viewer/articulations';

type Route =
  | { tab: 'lessons'; id?: string }
  | { tab: 'letters'; id: string }
  | { tab: 'contrast'; id: string }
  | { tab: 'dictionary'; id?: string }
  | { tab: 'checklist' };

function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [tab, id] = h.split('/');
  if (tab === 'letters') return { tab: 'letters', id: id && BY_ID[id] ? id : 'qaf' };
  if (tab === 'contrast') return { tab: 'contrast', id: id && CONTRAST_PAIRS.some((p) => p.id === id) ? id : CONTRAST_PAIRS[0].id };
  if (tab === 'dictionary') return { tab: 'dictionary', id: id && RULES[id] ? id : undefined };
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

const TABS: { tab: Route['tab']; label: string; hash: string }[] = [
  { tab: 'lessons', label: 'الدروس', hash: '#/lessons' },
  { tab: 'letters', label: 'الحروف', hash: '#/letters/qaf' },
  { tab: 'contrast', label: 'هذا، لا ذاك', hash: '#/contrast' },
  { tab: 'dictionary', label: 'القاموس', hash: '#/dictionary' },
  { tab: 'checklist', label: 'قائمة الجاهزية', hash: '#/checklist' },
];

export default function App() {
  const [route, go] = useRoute();
  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <a href="#/lessons" onClick={(e) => { e.preventDefault(); go('#/lessons'); }}>نُطق</a>
        </h1>
        <span className="sub">تعلّم نطق القرآن — رواية الدوري عن أبي عمرو</span>
      </header>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.tab} aria-pressed={route.tab === t.tab} onClick={() => go(t.hash)}>
            {t.label}
          </button>
        ))}
      </nav>
      {route.tab === 'lessons' && (route.id ? <LessonScreen ruleId={route.id} go={go} /> : <LessonsIndex go={go} />)}
      {route.tab === 'letters' && <LettersPage id={route.id} go={go} />}
      {route.tab === 'contrast' && <ContrastPage id={route.id} go={go} />}
      {route.tab === 'dictionary' && <DictionaryPage termId={route.id} go={go} />}
      {route.tab === 'checklist' && <ChecklistPage />}
    </div>
  );
}
