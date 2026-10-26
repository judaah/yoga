/** Русское склонение по числу: plural(5, 'поза', 'позы', 'поз') → 'поз'. */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = Math.abs(n) % 10;
  const m100 = Math.abs(n) % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** 45 → «45 с», 90 → «1 мин 30 с», 120 → «2 мин». */
export function formatSeconds(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest ? `${m} мин ${rest} с` : `${m} мин`;
}

/** Секунды → «12 мин» (округление до минуты, но не меньше 1). */
export function formatMinutes(sec: number): string {
  return `${Math.max(1, Math.round(sec / 60))} мин`;
}

/** Таймер: 75 → «1:15». */
export function clock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
