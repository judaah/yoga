import { db } from '../db/db';
import { getSetting, setSetting, SETTING_LAST_BACKUP } from '../db/repo';
import { backupFileName, exportBackup, needsBackupReminder } from '../lib/backup';
import { useLive } from '../lib/hooks';
import { deliver } from './files';
import { showToast } from './toast';

/** Плашка на «Сегодня», если бэкапа не было больше 14 дней. */
export function BackupReminder() {
  const state = useLive(async () => {
    const last = await getSetting<number | null>(SETTING_LAST_BACKUP, null);
    const first = await db.workouts.orderBy('startedAt').first();
    return needsBackupReminder(last, first?.startedAt ?? null);
  }, []);
  if (!state) return null;
  return (
    <div class="card card-pad backup-card">
      <div class="row-main">
        <span class="row-title">Сохрани бэкап</span>
        <span class="row-sub">Данные есть только на этом телефоне. Больше двух недель без копии — пора сохранить в Файлы или iCloud Drive.</span>
      </div>
      <button
        class="btn btn-small"
        onClick={async () => {
          const file = new File([JSON.stringify(await exportBackup())], backupFileName(), { type: 'application/json' });
          await deliver(file, async () => {
            await setSetting(SETTING_LAST_BACKUP, Date.now());
            showToast('Бэкап сохранён');
          });
        }}
      >
        Сохранить
      </button>
    </div>
  );
}
