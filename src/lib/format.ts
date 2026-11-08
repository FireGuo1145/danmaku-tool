/** 数字、金额、时间等展示格式化工具 */

function trimNumber(value: number): string {
  return value.toFixed(value >= 100 ? 0 : 1).replace(/\.0$/, '');
}

/** 12345 → 1.2万；123456789 → 1.2亿 */
export function formatCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1e8) return `${trimNumber(value / 1e8)}亿`;
  if (value >= 1e4) return `${trimNumber(value / 1e4)}万`;
  return value.toLocaleString('zh-CN');
}

/** 金瓜子换算成人民币：1000 金瓜子 = 1 元 */
export function formatGold(coins: number): string {
  if (!Number.isFinite(coins) || coins <= 0) return '¥0';
  const yuan = coins / 1000;
  if (yuan >= 1e4) return `¥${trimNumber(yuan / 1e4)}万`;
  if (yuan >= 100) return `¥${yuan.toFixed(0)}`;
  if (yuan >= 1) return `¥${yuan.toFixed(yuan % 1 === 0 ? 0 : 2)}`;
  return `¥${yuan.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`;
}

/** 银瓜子（免费礼物）价值 */
export function formatSilver(coins: number): string {
  if (!Number.isFinite(coins) || coins <= 0) return '0';
  return formatCount(coins);
}

export function formatTime(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

export function formatRelative(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  if (diff < 5000) return '刚刚';
  if (diff < 60_000) return `${Math.floor(diff / 1000)} 秒前`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  return `${Math.floor(diff / 3_600_000)} 小时前`;
}

function parseHex(color: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function toHex(rgb: [number, number, number]): string {
  return `#${rgb.map((item) => item.toString(16).padStart(2, '0')).join('')}`;
}

/** 深色背景下让过暗的弹幕颜色变得更易读 */
export function readableDanmakuColor(color: string): string {
  const rgb = parseHex(color);
  if (!rgb) return '#f2f5fb';
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  if (luminance >= 0.45) return toHex(rgb);
  const lighten = (channel: number) => Math.round(channel + (255 - channel) * 0.62);
  return toHex([lighten(rgb[0]), lighten(rgb[1]), lighten(rgb[2])]);
}

/** 给颜色加透明度，用于勋章底色 */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseHex(color);
  if (!rgb) return `rgba(255,255,255,${alpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function initials(name: string): string {
  const trimmed = (name || '?').trim();
  return trimmed.slice(0, 1).toUpperCase();
}

const GUARD_LABELS: Record<number, string> = { 1: '总督', 2: '提督', 3: '舰长' };

export function guardLabel(level: number): string {
  return GUARD_LABELS[level] ?? '';
}

/** 去掉公告里的 HTML 标签 */
export function stripTags(input: string): string {
  return (input || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
