import { Icon } from '../ui/icons';
import { useMemo } from 'react';
import { sampleState } from './engine';
import { LipsView } from './LipsView';
import { SideView } from './SideView';
import { TopView } from './TopView';
import type { Articulation, Phase } from './types';

const PHASE_AR: Record<Phase, string> = {
  rest: 'استرخاء',
  approach: 'اقتراب',
  contact: 'تلامس',
  hold: 'ثبات',
  release: 'إطلاق',
};

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦'];

/** The three synchronised views + indicators for one articulation at time t. */
export function ArticulationViewer({ art, t, compact = false }: { art: Articulation; t: number; compact?: boolean }) {
  const state = useMemo(() => sampleState(art, t), [art, t]);
  const nasal = state.airflow?.type === 'nasal' ? state.airflow.opacity : 0;
  const lipsFlow = state.airflow?.type === 'lips_channel' ? state.airflow.opacity : 0;
  const count = art.harakat && state.hold > 0 ? Math.min(art.harakat, Math.ceil(state.hold * art.harakat + 1e-6)) : 0;

  return (
    <div className={`viewer${art.wrong ? ' is-wrong' : ''}`}>
      <div className="viewer-title">
        <span className="letters">{art.letters}</span>
        <span className="name">{art.nameAr}</span>
        {state.heavy > 0.5 && <span className="badge heavy">مفخم</span>}
        {art.wrong && <span className="badge warn"><Icon name="x" size={14} /> هكذا لا</span>}
        {art.needsReview && !compact && (
          <span className="badge review" title={art.needsReview}>
            يُراجع
          </span>
        )}
      </div>
      <div className="views">
        <div className={`view side${art.wrong ? ' wrong' : ''}`}>
          <span className="caption">مقطع جانبي</span>
          <SideView state={state} letters={compact ? undefined : art.letters} />
        </div>
        <div className={`view${art.wrong ? ' wrong' : ''}`}>
          <span className="caption">الشفتان</span>
          <LipsView lips={state.lips} flowOpacity={lipsFlow} />
        </div>
        <div className={`view${art.wrong ? ' wrong' : ''}`}>
          <span className="caption">اللسان من أعلى</span>
          <TopView top={state.top} />
        </div>
      </div>
      <div className="indicators">
        <span className="phase">{PHASE_AR[state.phase]}</span>
        {art.harakat && (
          <span className="ticker" aria-label={`${art.tickerLabel ?? ''} ${count} من ${art.harakat}`}>
            <span className="phase">{art.tickerLabel}</span>
            {Array.from({ length: art.harakat }, (_, i) => (
              <span key={i} className={`cell${i < count ? ' on' : ''}`}>
                {ARABIC_DIGITS[i + 1]}
              </span>
            ))}
          </span>
        )}
        <span className={`nose${nasal > 0.5 ? ' on' : ''}`} aria-label="الغنة من الأنف">
          <Icon name="nose" size={18} /> {nasal > 0.5 ? 'الصوت من الأنف' : 'الأنف'}
        </span>
        <span className="phase">اللهاة: {state.velum > 0.5 ? 'مرفوعة (الأنف مغلق)' : 'منخفضة (الأنف مفتوح)'}</span>
      </div>
    </div>
  );
}
