import { useEffect, useRef, useState } from 'preact/hooks';
import type { Profile, SessionPlan } from '../data/program';
import { activeProgram, currentWeek, getSetting, setSetting, SETTING_PROFILE, SETTING_SOUND, SETTING_VOICE, weekState } from '../db/repo';
import { db } from '../db/db';
import { FlexTestSheet } from './FlexTest';
import { Settings } from './Settings';
import { BackupReminder } from './BackupReminder';
import { Progress, TodayProgress } from './Progress';
import { Practice, SETTING_RUN, type SavedRun } from './Practice';
import { useLive, useToday } from '../lib/hooks';
import { Onboarding } from './Onboarding';
import { Poses } from './Poses';
import { ProgramScreen } from './ProgramScreen';
import { SessionPreview } from './SessionPreview';
import { Today } from './Today';
import { Toasts } from './toast';
import { UpdatePrompt } from './UpdatePrompt';
import { IconCalendar, IconChart, IconFigure, IconSun } from './icons';

type Tab = 'today' | 'program' | 'progress' | 'poses';

const TABS: Array<{ id: Tab; label: string; icon: () => preact.JSX.Element }> = [
  { id: 'today', label: 'Сегодня', icon: () => <IconSun /> },
  { id: 'program', label: 'Программа', icon: () => <IconCalendar /> },
  { id: 'progress', label: 'Прогресс', icon: () => <IconChart /> },
  { id: 'poses', label: 'Позы', icon: () => <IconFigure /> },
];

export function App() {
  const [tab, setTab] = useState<Tab>('today');
  const day = useToday();
  const program = useLive(() => activeProgram(), []);
  const lastProfile = useLive(() => getSetting<Profile | null>(SETTING_PROFILE, null), []);
  // weekState читает журнал — useLive перерисует экран, когда занятие запишется.
  const week = useLive(async () => (program ? weekState(program, currentWeek(program, day)) : null), [program, day]);
  const [questionnaire, setQuestionnaire] = useState(false);
  const [preview, setPreview] = useState<{ plan: SessionPlan; canStart: boolean } | null>(null);
  const [flexTest, setFlexTest] = useState(false);
  const [settings, setSettings] = useState(false);
  const [practice, setPractice] = useState<{ plan: SessionPlan; saved?: SavedRun } | null>(null);
  const savedRun = useLive(() => getSetting<SavedRun | null>(SETTING_RUN, null), []);
  const voiceOn = useLive(() => getSetting(SETTING_VOICE, true), []) ?? true;
  const soundOn = useLive(() => getSetting(SETTING_SOUND, true), []) ?? true;
  const scroller = useRef<HTMLElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo(0, 0);
  }, [tab]);

  if (program === undefined) return null;

  const start = (plan: SessionPlan) => {
    setPreview(null);
    setPractice({ plan });
  };

  const resumeCard = savedRun && !practice && (
    <div class="card card-pad resume-card">
      <div class="row-main">
        <span class="session-card-kicker">Незаконченное занятие</span>
        <span class="row-title">
          {savedRun.plan.title}: поза {savedRun.state.index + 1} из {savedRun.plan.steps.length}
        </span>
      </div>
      <div class="session-card-actions">
        <button class="btn" onClick={() => setPractice({ plan: savedRun.plan, saved: savedRun })}>
          Продолжить
        </button>
        <button class="btn btn-plain" onClick={() => void db.settings.delete(SETTING_RUN)}>
          Сбросить
        </button>
      </div>
    </div>
  );

  return (
    <div class="app">
      <main class="screen" ref={scroller}>
        <UpdatePrompt />
        {tab === 'today' && (
          <Today
            day={day}
            program={program}
            week={week ?? null}
            onQuestionnaire={() => setQuestionnaire(true)}
            onPreview={(plan) => setPreview({ plan, canStart: true })}
            onStart={start}
            onSettings={() => setSettings(true)}
            extra={
              <>
                {resumeCard}
                <TodayProgress day={day} program={program} onTest={() => setFlexTest(true)} />
                <BackupReminder />
              </>
            }
          />
        )}
        {tab === 'program' && (
          <ProgramScreen program={program} day={day} onQuestionnaire={() => setQuestionnaire(true)} onPreview={(plan, canStart) => setPreview({ plan, canStart })} />
        )}
        {tab === 'progress' && <Progress day={day} program={program} />}
        {tab === 'poses' && <Poses />}
      </main>
      <nav class="tabbar">
        {TABS.map((t) => (
          <button key={t.id} class={`tab ${tab === t.id ? 'is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.icon()}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {questionnaire && (
        <Onboarding
          initial={lastProfile}
          onClose={() => setQuestionnaire(false)}
          onDone={() => {
            setQuestionnaire(false);
            setTab('today');
          }}
        />
      )}
      {preview && <SessionPreview plan={preview.plan} onClose={() => setPreview(null)} onStart={preview.canStart ? () => start(preview.plan) : undefined} />}
      {flexTest && <FlexTestSheet onClose={() => setFlexTest(false)} />}
      {settings && <Settings program={program} onClose={() => setSettings(false)} onQuestionnaire={() => setQuestionnaire(true)} />}
      {practice && (
        <Practice
          plan={practice.plan}
          saved={practice.saved}
          voiceOn={voiceOn}
          soundOn={soundOn}
          onToggleVoice={() => void setSetting(SETTING_VOICE, !voiceOn)}
          onClose={() => setPractice(null)}
        />
      )}
      <Toasts />
    </div>
  );
}
