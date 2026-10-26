// Простые контурные иконки 24×24, цвет берут из currentColor.

type IconProps = { size?: number };

const svg = (path: preact.ComponentChildren, { size = 24 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {path}
  </svg>
);

export const IconSun = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>,
    p,
  );

export const IconCalendar = (p: IconProps) =>
  svg(
    <>
      <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </>,
    p,
  );

export const IconChart = (p: IconProps) =>
  svg(
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>,
    p,
  );

export const IconFigure = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M4 9.5c2.5 1 5 1.5 8 1.5s5.5-.5 8-1.5M12 11v4.5M12 15.5l-3.5 6M12 15.5l3.5 6" />
    </>,
    p,
  );

export const IconSettings = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>,
    p,
  );

export const IconClose = (p: IconProps) => svg(<path d="M6 6l12 12M18 6 6 18" />, p);
export const IconBack = (p: IconProps) => svg(<path d="M15 5l-7 7 7 7" />, p);
export const IconChevron = (p: IconProps) => svg(<path d="M9 5l7 7-7 7" />, p);
export const IconCheck = (p: IconProps) => svg(<path d="M4.5 12.5l5 5L19.5 7" />, p);
export const IconPlus = (p: IconProps) => svg(<path d="M12 5v14M5 12h14" />, p);
export const IconSearch = (p: IconProps) =>
  svg(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>,
    p,
  );

export const IconPlay = (p: IconProps) => svg(<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />, p);
export const IconPause = (p: IconProps) => svg(<path d="M7.5 5v14M16.5 5v14" stroke-width="3" />, p);
export const IconNext = (p: IconProps) => svg(<path d="M5 5l9 7-9 7zM18.5 5v14" />, p);
export const IconPrev = (p: IconProps) => svg(<path d="M19 5l-9 7 9 7zM5.5 5v14" />, p);

export const IconVolume = (p: IconProps) =>
  svg(
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>,
    p,
  );

export const IconMute = (p: IconProps) =>
  svg(
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
    </>,
    p,
  );

export const IconFlame = (p: IconProps) =>
  svg(<path d="M12 21.5c-4 0-7-2.7-7-6.6 0-3.6 2.6-5.6 3.6-8.4.4 1.8 1.3 2.9 2.4 3.4C11.4 6.4 12.8 3.8 15 2.5c-.2 3.3 1.6 4.9 2.9 6.9 1 1.5 1.6 3.2 1.6 5.2 0 4-3 6.9-7.5 6.9z" />, p);

export const IconClock = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>,
    p,
  );
