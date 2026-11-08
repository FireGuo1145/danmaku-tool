const env = import.meta.env;

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function readInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function readString(value: string | undefined, fallback = ''): string {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? fallback : trimmed;
}

function normalizeBase(value: string): string {
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, '');
  return `/${value.replace(/^\/+|\/+$/g, '')}`;
}

const protoverRaw = readInt(env.VITE_PROTOVER, 2, 1, 3);
if (protoverRaw === 3) {
  console.warn('[弹幕台] 浏览器端暂不支持 Brotli（VITE_PROTOVER=3），已自动降级为 2');
}

const quickRooms = readString(env.VITE_QUICK_ROOMS, '7734200,21144080,3947892,5050')
  .split(',')
  .map((item) => Number.parseInt(item.trim(), 10))
  .filter((item) => Number.isInteger(item) && item > 0);

export const config = {
  title: readString(env.VITE_APP_TITLE, '弹幕台'),
  apiBase: normalizeBase(readString(env.VITE_BILI_API_BASE, '/bili-api')),
  defaultRoomId: readInt(env.VITE_DEFAULT_ROOM_ID, 5440, 1, Number.MAX_SAFE_INTEGER),
  autoConnect: readBool(env.VITE_AUTO_CONNECT, true),
  demoMode: readBool(env.VITE_DEMO_MODE, false),
  uid: readInt(env.VITE_BILI_UID, 0, 0, Number.MAX_SAFE_INTEGER),
  buvid: readString(env.VITE_BILI_BUVID),
  token: readString(env.VITE_BILI_TOKEN),
  protover: (protoverRaw === 1 ? 1 : 2) as 1 | 2,
  maxMessages: readInt(env.VITE_MAX_MESSAGES, 200, 50, 2000),
  showEnter: readBool(env.VITE_SHOW_ENTER, true),
  showLike: readBool(env.VITE_SHOW_LIKE, false),
  giftToastMin: readInt(env.VITE_GIFT_TOAST_MIN, 1000, 0, Number.MAX_SAFE_INTEGER),
  /** 访客弹幕凭证刷新间隔（分钟），0 表示关闭定期刷新 */
  authRefreshMinutes: readInt(env.VITE_AUTH_REFRESH_MINUTES, 10, 0, 120),
  quickRooms,
} as const;
