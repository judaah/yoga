// Голос айфона (синтез речи, работает без интернета), короткие сигналы и «экран не гаснет».
// На iOS речь и звук разрешаются только после нажатия — поэтому unlockAudio() зовём из кнопки «Начать».

let ctx: AudioContext | null = null;
let voice: SpeechSynthesisVoice | null = null;

const synth = (): SpeechSynthesis | null => (typeof speechSynthesis === 'undefined' ? null : speechSynthesis);

function pickVoice() {
  const voices = synth()?.getVoices() ?? [];
  const ru = voices.filter((v) => v.lang.toLowerCase().startsWith('ru'));
  // На айфоне русские голоса: Milena (по умолчанию), Yuri, Katya; улучшенные версии звучат лучше.
  voice = ru.find((v) => /enhanced|premium|улучш/i.test(v.name)) ?? ru.find((v) => /milena/i.test(v.name)) ?? ru[0] ?? null;
}

if (synth()) {
  pickVoice();
  synth()!.addEventListener?.('voiceschanged', pickVoice);
}

/** Есть ли вообще русский голос — если нет, в настройках покажем подсказку. */
export const hasRussianVoice = () => {
  pickVoice();
  return !!voice;
};

export function unlockAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC && !ctx) ctx = new AC();
    void ctx?.resume();
  } catch {
    ctx = null;
  }
  const s = synth();
  if (s) {
    // пустая фраза внутри нажатия «разрешает» дальнейшую речь на iOS
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    s.speak(u);
  }
}

export function say(text: string, opts: { interrupt?: boolean } = {}): void {
  const s = synth();
  if (!s || !text) return;
  if (opts.interrupt) s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ru-RU';
  if (voice) u.voice = voice;
  u.rate = 0.95;
  s.speak(u);
}

export function stopSpeech(): void {
  synth()?.cancel();
}

export type Tone = 'hold' | 'next' | 'tick' | 'end' | 'in' | 'out';

/** Короткий сигнал: сгенерированный звук, без файлов. */
export function tone(kind: Tone): void {
  if (!ctx) return;
  const notes: Record<Tone, Array<[number, number, number]>> = {
    // [частота, начало, длительность]
    hold: [[660, 0, 0.18]],
    next: [
      [523, 0, 0.12],
      [784, 0.12, 0.2],
    ],
    tick: [[880, 0, 0.06]],
    end: [
      [523, 0, 0.25],
      [659, 0.2, 0.25],
      [784, 0.4, 0.5],
    ],
    in: [
      [392, 0, 0.12],
      [494, 0.1, 0.18],
    ],
    out: [
      [494, 0, 0.12],
      [392, 0.1, 0.18],
    ],
  };
  const t0 = ctx.currentTime;
  for (const [freq, start, dur] of notes[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + start);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + start);
    osc.stop(t0 + start + dur + 0.05);
  }
}

// ---------- экран не гаснет ----------

let lock: WakeLockSentinel | null = null;

/** true — экран удерживается; false — браузер так не умеет (iOS до 18.4 на экране «Домой»). */
export async function keepAwake(): Promise<boolean> {
  try {
    if (!('wakeLock' in navigator)) return false;
    if (lock && !lock.released) return true;
    lock = await navigator.wakeLock.request('screen');
    return true;
  } catch {
    return false;
  }
}

export function releaseAwake(): void {
  void lock?.release().catch(() => undefined);
  lock = null;
}
