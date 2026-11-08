/** 极简路径路由：/ 为主界面，其余为适合 OBS 嵌入的独立视图 */

export type OverlayMode = 'danmaku' | 'gift' | 'superchat' | 'stats';

export type AppRoute = { kind: 'app' } | { kind: 'overlay'; mode: OverlayMode };

const ROUTES: Record<string, OverlayMode> = {
  '/danmaku': 'danmaku',
  '/overlay': 'danmaku',
  '/gift': 'gift',
  '/superchat': 'superchat',
  '/sc': 'superchat',
  '/stats': 'stats',
};

export function resolveRoute(pathname: string = window.location.pathname): AppRoute {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase() || '/';
  const mode = ROUTES[normalized];
  return mode ? { kind: 'overlay', mode } : { kind: 'app' };
}

export const OVERLAY_LINKS: Array<{ path: string; mode: OverlayMode; label: string }> = [
  { path: '/danmaku', mode: 'danmaku', label: '弹幕' },
  { path: '/gift', mode: 'gift', label: '礼物' },
  { path: '/superchat', mode: 'superchat', label: '醒目留言' },
  { path: '/stats', mode: 'stats', label: '数据' },
];
