import { useRef, useState } from 'preact/hooks';
import type { Program } from '../data/program';
import { getSetting, setSetting, SETTING_LAST_BACKUP, SETTING_SOUND, SETTING_VOICE } from '../db/repo';
import { backupFileName, exportBackup, parseBackup, restoreBackup, type BackupFile } from '../lib/backup';
import { formatShortDate, today } from '../lib/dates';
import { useLive } from '../lib/hooks';
import { programIcs } from '../lib/ics';
import { hasRussianVoice, say, tone, unlockAudio } from '../lib/voice';
import { deliver, openCalendarFile } from './files';
import { Sheet } from './Sheet';
import { showToast } from './toast';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button class="row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span class="row-main">
        <span class="row-title">{label}</span>
      </span>
      <span class={`switch ${on ? 'is-on' : ''}`} aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

export function Settings({ program, onClose, onQuestionnaire }: { program: Program | null; onClose: () => void; onQuestionnaire: () => void }) {
  const voiceOn = useLive(() => getSetting(SETTING_VOICE, true), []) ?? true;
  const soundOn = useLive(() => getSetting(SETTING_SOUND, true), []) ?? true;
  const lastBackup = useLive(() => getSetting<number | null>(SETTING_LAST_BACKUP, null), []);
  const [restore, setRestore] = useState<BackupFile | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [noVoice] = useState(() => !hasRussianVoice());

  const saveBackup = async () => {
    const file = new File([JSON.stringify(await exportBackup())], backupFileName(), { type: 'application/json' });
    await deliver(file, async () => {
      await setSetting(SETTING_LAST_BACKUP, Date.now());
      showToast('Бэкап сохранён');
    });
  };

  const pickBackup = async (f: File) => {
    try {
      setRestore(parseBackup(await f.text()));
    } catch (err) {
      showToast((err as Error).message);
    }
  };

  return (
    <Sheet full title="Настройки" onClose={onClose}>
      <section class="section" style={{ marginTop: 0 }}>
        <h3 class="section-head">Во время занятия</h3>
        <div class="card">
          <Toggle label="Голос называет позы" on={voiceOn} onChange={(v) => void setSetting(SETTING_VOICE, v)} />
          <Toggle label="Сигналы смены позы" on={soundOn} onChange={(v) => void setSetting(SETTING_SOUND, v)} />
          <button
            class="row"
            onClick={() => {
              unlockAudio();
              tone('next');
              say('Собака мордой вниз. Длинная спина важнее прямых ног.', { interrupt: true });
            }}
          >
            <span class="row-title accent">Проверить голос и звук</span>
          </button>
        </div>
        {noVoice && (
          <p class="wizard-sub">
            Русского голоса не нашлось. На айфоне: Настройки → Универсальный доступ → Устный контент → Голоса → Русский — и скачай голос.
          </p>
        )}
      </section>

      <section class="section">
        <h3 class="section-head">Напоминания</h3>
        <div class="card">
          <button
            class="row"
            disabled={!program}
            onClick={() => program && void openCalendarFile(new File([programIcs(program)], 'yoga.ics', { type: 'text/calendar' }))}
          >
            <span class="row-main">
              <span class="row-title accent">Добавить занятия в Календарь</span>
              <span class="row-sub">
                {program
                  ? `Повторяющееся событие в ${program.profile.remindAt} на все дни программы, напоминание за 10 минут`
                  : 'Сначала подбери программу'}
              </span>
            </span>
          </button>
        </div>
        <p class="wizard-sub">Сменил дни или время в анкете — добавь заново, а старое событие удали в Календаре.</p>
      </section>

      <section class="section">
        <h3 class="section-head">Данные</h3>
        <div class="card">
          <button class="row" onClick={() => void saveBackup()}>
            <span class="row-main">
              <span class="row-title accent">Сохранить бэкап</span>
              <span class="row-sub">
                {lastBackup ? `Последний — ${formatShortDate(today(new Date(lastBackup)))}` : 'Ещё не сохранялся'} · «Поделиться» → «Сохранить в Файлы»
              </span>
            </span>
          </button>
          <button class="row" onClick={() => fileInput.current?.click()}>
            <span class="row-main">
              <span class="row-title accent">Восстановить из бэкапа</span>
              <span class="row-sub">Заменит все данные на этом телефоне</span>
            </span>
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (f) void pickBackup(f);
          }}
        />
        <p class="wizard-sub">Все данные хранятся только на этом телефоне. Удалишь приложение с экрана «Домой» — они пропадут, поэтому иногда сохраняй бэкап.</p>
      </section>

      {program && (
        <section class="section">
          <div class="card">
            <button
              class="row"
              onClick={() => {
                onClose();
                onQuestionnaire();
              }}
            >
              <span class="row-main">
                <span class="row-title accent">Пройти анкету заново</span>
                <span class="row-sub">Будет новая программа, история сохранится</span>
              </span>
            </button>
          </div>
        </section>
      )}

      <section class="section">
        <h3 class="section-head">О приложении</h3>
        <div class="card card-pad">
          <p class="sheet-text">
            Йога · версия {__APP_VERSION__} от {__BUILD_DATE__}. Работает без интернета.
          </p>
          <p class="wizard-sub" style={{ marginBottom: 0 }}>
            Приложение не заменяет врача и инструктора. Если есть заболевания — посоветуйся с врачом. В позе больно — сразу выходи из неё.
          </p>
        </div>
      </section>

      {restore && (
        <Sheet title="Восстановить из бэкапа?" onClose={() => setRestore(null)}>
          <p class="sheet-text">
            Бэкап от {formatShortDate(restore.exportedAt.slice(0, 10))}: занятий — {restore.tables.workouts.length}, программ — {restore.tables.programs.length}, тестов —{' '}
            {restore.tables.tests.length}. Всё, что сейчас в приложении, заменится.
          </p>
          <button
            class="btn btn-block btn-danger"
            style={{ marginTop: 16 }}
            onClick={async () => {
              await restoreBackup(restore);
              setRestore(null);
              showToast('Данные восстановлены');
              onClose();
            }}
          >
            Заменить данные
          </button>
          <button class="btn btn-block btn-plain" style={{ marginTop: 10 }} onClick={() => setRestore(null)}>
            Отмена
          </button>
        </Sheet>
      )}
    </Sheet>
  );
}
