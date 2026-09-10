import { useMemo } from 'react';
import { SURAHS } from '../audio/quran';
import { loadDeck } from '../exercises/leitner';
import { DRILLS } from '../content/drills';
import { Icon } from '../ui/icons';
import { getSettings } from '../ui/settings';
import { arNum } from './shared';

/** Practice hub: exercises, Dūrī drills, follow-along, contrast pairs. */
export function PracticePage({ go }: { go: (hash: string) => void }) {
  const due = useMemo(() => {
    const now = Date.now();
    return Object.values(loadDeck()).filter((c) => c.due <= now).length;
  }, []);
  return (
    <div className="page lessons stagger">
      <div className="card">
        <h2>التدريب</h2>
        <p className="ref">ثلاث طرق للتمرّن: أسئلة من المصحف، تدريبات ما يميز الدوري، والقراءة مع القارئ كلمة كلمة.</p>
      </div>
      <div className="quick">
        <button className="quick-card" onClick={() => go('#/wird')}>
          <Icon name="calendar" />
          <strong>الورد اليومي</strong>
          <small>ربع أو حزب أو جزء كل يوم، حتى الختمة</small>
        </button>
        <button className="quick-card" onClick={() => go('#/hifz')}>
          <Icon name="star" />
          <strong>تحدي الحفظ</strong>
          <small>خمس آيات كاملة كل يوم، بترتيب الخلوة</small>
        </button>
        <button className="quick-card" onClick={() => go('#/exercises')}>
          <Icon name="target" />
          <strong>التمارين</strong>
          <small>{due > 0 ? `${arNum(due)} سؤالاً حان وقت مراجعته` : 'أين القاعدة؟ ماذا يحدث للنون؟ اسمع واختر…'}</small>
        </button>
        <button className="quick-card" onClick={() => go('#/drills')}>
          <Icon name="zap" />
          <strong>تدريبات الدوري</strong>
          <small>{arNum(DRILLS.length)} تدريبات: شاهد، اسمع ببطء، سجّل، قارن</small>
        </button>
        <button className="quick-card" onClick={() => go(`#/follow/${getSettings().lastSurah || 1}`)}>
          <Icon name="headphones" />
          <strong>المتابعة</strong>
          <small>{arNum(SURAHS.length)} سورة مع القارئ</small>
        </button>
        <button className="quick-card" onClick={() => go('#/contrast')}>
          <Icon name="split" />
          <strong>هذا، لا ذاك</strong>
          <small>الأزواج المتشابهة جنباً إلى جنب</small>
        </button>
      </div>
    </div>
  );
}
