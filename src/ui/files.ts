import { showToast } from './toast';

// На телефоне отдаём файл через «Поделиться» (там есть «Сохранить в Файлы»),
// на компьютере — обычным скачиванием.
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Отдаёт файл; onSaved — только когда файл точно отдан, а не при отмене. */
export async function deliver(file: File, onSaved: () => void | Promise<void>): Promise<void> {
  if (!isTouchDevice() || !navigator.canShare?.({ files: [file] })) {
    download(file);
    await onSaved();
    return;
  }
  try {
    await navigator.share({ files: [file] });
    await onSaved();
  } catch (err) {
    const name = (err as DOMException).name;
    if (name === 'AbortError') return; // закрыл меню «Поделиться»
    if (name === 'NotAllowedError') {
      // Safari не дал открыть меню после подготовки файла — просим ещё одно нажатие
      showToast('Файл готов', { action: 'Сохранить', onAction: () => void deliver(file, onSaved) });
      return;
    }
    throw err;
  }
}

/**
 * Файл .ics: Safari на айфоне, открыв его, сам предлагает добавить события в Календарь.
 * Не открылось (так бывает в приложении с экрана «Домой») — в тосте есть запасной путь
 * через «Поделиться» → «Сохранить в Файлы», а из «Файлов» .ics тоже добавляется в Календарь.
 */
export async function openCalendarFile(file: File): Promise<void> {
  const text = await file.text();
  const a = document.createElement('a');
  a.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(text)}`;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast('Календарь не открылся?', {
    action: 'Файлом',
    onAction: () => void deliver(file, () => showToast('Открой yoga.ics в «Файлах» — Календарь предложит добавить события')),
  });
}
