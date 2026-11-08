import { config } from '../config';
import type { OverlayMode } from './router';

export interface OverlayConfig {
  mode: OverlayMode;
  roomId: number;
  demo: boolean;
  theme: 'transparent' | 'dark';
  /** 是否显示顶部信息条与底部提示 */
  chrome: boolean;
  /** 是否允许手动滚动查看历史（默认始终锁定最新消息） */
  scrollable: boolean;
  fontSize: number;
  maxMessages: number;
  showEnter: boolean;
  showLike: boolean;
  showGuard: boolean;
  showSuperChat: boolean;
}

function readInt(params: URLSearchParams, key: string, fallback: number, min: number, max: number): number {
  const value = Number.parseInt(params.get(key) ?? '', 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readFlag(params: URLSearchParams, key: string, fallback: boolean): boolean {
  const value = params.get(key);
  if (value === null) return fallback;
  return !/^(0|false|no|off)$/i.test(value);
}

/**
 * 嵌入视图参数（全部通过 URL 查询串控制，不会写入 localStorage）：
 *
 * /danmaku?room=123&theme=dark&font=16&max=80&enter=1&like=0&guard=1&sc=1&chrome=0&scroll=1
 *
 * 默认不传 scroll 时列表始终锚定最新消息、不可手动滚动，适合 OBS 直接叠加。
 */
export function readOverlayConfig(mode: OverlayMode): OverlayConfig {
  const params = new URLSearchParams(window.location.search);
  const roomParam = Number.parseInt(params.get('room') ?? '', 10);
  const roomId = Number.isInteger(roomParam) && roomParam > 0 ? roomParam : config.defaultRoomId;
  const demoParam = params.get('demo');

  const themeParam = params.get('theme');
  // /danmaku 与主界面一致，默认深色；其他嵌入视图默认透明
  const theme: 'transparent' | 'dark' =
    themeParam === 'transparent' ? 'transparent' : themeParam === 'dark' ? 'dark' : mode === 'danmaku' ? 'dark' : 'transparent';
  // /danmaku 默认展示全部消息类型，其他视图默认精简
  const fullFeed = mode === 'danmaku';

  return {
    mode,
    roomId,
    demo: demoParam === '1' || (demoParam === null && config.demoMode),
    theme,
    chrome: readFlag(params, 'chrome', true),
    scrollable: readFlag(params, 'scroll', false),
    fontSize: readInt(params, 'font', fullFeed ? 14 : 15, 12, 32),
    maxMessages: readInt(params, 'max', fullFeed ? 200 : 80, 20, 500),
    showEnter: readFlag(params, 'enter', fullFeed),
    showLike: readFlag(params, 'like', fullFeed),
    showGuard: readFlag(params, 'guard', true),
    showSuperChat: readFlag(params, 'sc', true),
  };
}
