// Напоминания через Календарь айфона: файл .ics с повторяющимся событием на дни занятий.
// Время «плавающее» (без часового пояса) — событие в 19:30 останется в 19:30 и в другом городе.

import { PROGRAM_WEEKS, type Program } from '../data/program';
import { addDays, parseISODate } from './dates';

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (iso: string, hhmm: string) => `${iso.replace(/-/g, '')}T${hhmm.replace(':', '')}00`;

/** Экранирование текста по RFC 5545. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function programIcs(program: Program, now: Date = new Date()): string {
  const days = [...program.profile.days].sort();
  // первое занятие — ближайший выбранный день не раньше старта программы
  let first = program.startDate;
  while (!days.includes((parseISODate(first).getDay() + 6) % 7)) first = addDays(first, 1);
  const last = addDays(program.startDate, PROGRAM_WEEKS * 7 - 1);
  const [h, m] = program.profile.remindAt.split(':').map(Number);
  const endMin = h * 60 + m + program.profile.minutes;
  const end = `${pad(Math.floor(endMin / 60) % 24)}:${pad(endMin % 60)}`;
  // занятие через полночь кончается на следующий день
  const endDate = endMin >= 24 * 60 ? addDays(first, 1) : first;
  const utc = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//yoga//ru',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:yoga-${program.id}@yoga`,
    `DTSTAMP:${utc}`,
    `DTSTART:${stamp(first, program.profile.remindAt)}`,
    `DTEND:${stamp(endDate, end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${days.map((d) => BYDAY[d]).join(',')};UNTIL=${last.replace(/-/g, '')}T235959`,
    `SUMMARY:${esc(`Йога, ${program.profile.minutes} мин`)}`,
    `DESCRIPTION:${esc(`Занятие по программе ${program.number}. Открой приложение «Йога».`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc('Пора на коврик')}`,
    'TRIGGER:-PT10M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
