import type { ReactNode } from 'react';

export interface IconProps {
  size?: number;
  className?: string;
}

function icon(children: ReactNode, { size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconChat(props: IconProps) {
  return icon(
    <>
      <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3 8.9 8.9 0 0 1-3.7-.8L4 20.5l1.4-4.2a8 8 0 0 1-1.4-4.6A8.4 8.4 0 0 1 12.5 3.4 8.4 8.4 0 0 1 21 11.5Z" />
      <path d="M8.5 11.5h7M8.5 14.8h4.5" />
    </>,
    props,
  );
}

export function IconGift(props: IconProps) {
  return icon(
    <>
      <rect x="3.2" y="8.6" width="17.6" height="4.2" rx="1.3" />
      <path d="M5 12.8v6.4a1.6 1.6 0 0 0 1.6 1.6h10.8a1.6 1.6 0 0 0 1.6-1.6v-6.4M12 8.6v11.2" />
      <path d="M12 8.6C10.8 5.9 9.6 4.5 8.1 4.5a2.1 2.1 0 1 0 0 4.1H12Zm0 0c1.2-2.7 2.4-4.1 3.9-4.1a2.1 2.1 0 1 1 0 4.1H12Z" />
    </>,
    props,
  );
}

export function IconStar(props: IconProps) {
  return icon(<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8L12 3.6Z" />, props);
}

export function IconCrown(props: IconProps) {
  return icon(
    <>
      <path d="M3.4 8.2 6.9 11l2.4-4.6L12 10l2.7-3.6L17.1 11l3.5-2.8-1.4 8.6a1.4 1.4 0 0 1-1.4 1.2H6.2a1.4 1.4 0 0 1-1.4-1.2L3.4 8.2Z" />
    </>,
    props,
  );
}

export function IconHeart(props: IconProps) {
  return icon(
    <path d="M12 20.2s-7.7-4.5-7.7-9.6a4.2 4.2 0 0 1 7.7-2.4 4.2 4.2 0 0 1 7.7 2.4c0 5.1-7.7 9.6-7.7 9.6Z" />,
    props,
  );
}

export function IconUsers(props: IconProps) {
  return icon(
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3.2 20.2a5.8 5.8 0 0 1 11.6 0M16 4.9a3.4 3.4 0 0 1 0 6.4M17.6 14.6a5.8 5.8 0 0 1 3.2 5.6" />
    </>,
    props,
  );
}

export function IconEye(props: IconProps) {
  return icon(
    <>
      <path d="M2.6 12S5.8 6.2 12 6.2 21.4 12 21.4 12 18.2 17.8 12 17.8 2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>,
    props,
  );
}

export function IconFlame(props: IconProps) {
  return icon(
    <path d="M12 21c3.6 0 6.2-2.4 6.2-5.8 0-2.6-1.4-4.4-3-6.2-1.2-1.3-2.2-2.9-2.4-4.9-2.4 1.6-3.6 3.7-3.6 5.6 0 1 .3 1.8.8 2.5-1.2-.2-2.1-1-2.6-2.1-1 1.4-1.6 3-1.6 4.9C5.8 18.6 8.4 21 12 21Z" />,
    props,
  );
}

export function IconCoins(props: IconProps) {
  return icon(
    <>
      <ellipse cx="12" cy="7" rx="7" ry="3.2" />
      <path d="M5 7v5c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2V7M5 12v5c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2v-5" />
    </>,
    props,
  );
}

export function IconSettings(props: IconProps) {
  return icon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.3 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>,
    props,
  );
}

export function IconPower(props: IconProps) {
  return icon(
    <>
      <path d="M12 3.2v8.4" />
      <path d="M6.6 6.2a7.6 7.6 0 1 0 10.8 0" />
    </>,
    props,
  );
}

export function IconClose(props: IconProps) {
  return icon(<path d="M6 6l12 12M18 6 6 18" />, props);
}

export function IconTrash(props: IconProps) {
  return icon(
    <>
      <path d="M4 7h16M9.5 7V4.8h5V7M6.4 7l.9 12.2a1.8 1.8 0 0 0 1.8 1.6h5.8a1.8 1.8 0 0 0 1.8-1.6L18.6 7" />
      <path d="M10.2 11v6M13.8 11v6" />
    </>,
    props,
  );
}

export function IconArrowDown(props: IconProps) {
  return icon(<path d="M12 4.5v14M6.4 13.2 12 18.8l5.6-5.6" />, props);
}

export function IconExternal(props: IconProps) {
  return icon(
    <>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5 11 13" />
      <path d="M18 14.2v4.3a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5V7.5A1.5 1.5 0 0 1 5.5 6H10" />
    </>,
    props,
  );
}

export function IconRefresh(props: IconProps) {
  return icon(
    <>
      <path d="M20.2 11a8.2 8.2 0 1 0-2.3 6.4" />
      <path d="M20.5 4.6v6.2h-6.2" />
    </>,
    props,
  );
}

export function IconSparkle(props: IconProps) {
  return icon(
    <>
      <path d="M12 3.5 13.6 8l4.5 1.6-4.5 1.6L12 15.7l-1.6-4.5L5.9 9.6 10.4 8 12 3.5Z" />
      <path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </>,
    props,
  );
}

export function IconPin(props: IconProps) {
  return icon(
    <>
      <path d="M9 4.5h6l-.8 5 3.3 3.2H6.5L9.8 9.5 9 4.5Z" />
      <path d="M12 12.7V20" />
    </>,
    props,
  );
}
