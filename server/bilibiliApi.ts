import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { DanmakuCredentials, RoomBundle, RoomMeta } from '../shared/api.ts';

/**
 * 本地开发 / 预览服务器上的 B 站接口代理。
 *
 * 浏览器端无法直接请求 api.live.bilibili.com（没有 CORS 响应头），
 * 因此在 Vite 中间件里代为请求房间信息、弹幕 token 与 buvid。
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface BiliApiResponse<T> {
  code: number;
  message?: string;
  msg?: string;
  data: T;
}

interface RoomInitData {
  room_id: number;
  short_id: number;
  uid: number;
  live_status: number;
  live_time: number;
}

interface RoomInfoData {
  room_id: number;
  short_id: number;
  uid: number;
  title: string;
  user_cover: string;
  keyframe: string;
  live_status: number;
  live_time: string;
  area_name: string;
  parent_area_name: string;
  attention: number;
  online: number;
  description: string;
}

interface AnchorInfoData {
  info: { uid: number; uname: string; face: string };
}

interface DanmuConfData {
  token: string;
  host: string;
  port: number;
  host_server_list?: Array<{
    host: string;
    port: number;
    ws_port?: number;
    wss_port?: number;
  }>;
}

interface DanmuInfoData {
  token: string;
  host_list?: Array<{
    host: string;
    port: number;
    ws_port?: number;
    wss_port?: number;
  }>;
}

interface SpiData {
  b_3: string;
  b_4: string;
}

const store = new Map<string, { expires: number; value: unknown }>();

async function cached<T>(key: string, ttl: number, factory: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await factory();
  store.set(key, { expires: Date.now() + ttl, value });
  return value;
}

async function apiJson<T>(url: string, referer: string, cookie = ''): Promise<BiliApiResponse<T>> {
  const res = await fetch(url, {
    headers: {
      'user-agent': UA,
      referer,
      origin: 'https://live.bilibili.com',
      accept: 'application/json, text/plain, */*',
      'accept-language': 'zh-CN,zh;q=0.9',
      ...(cookie ? { cookie } : {}),
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as BiliApiResponse<T>;
}

async function apiGet<T>(url: string, referer: string, cookie = ''): Promise<T> {
  const body = await apiJson<T>(url, referer, cookie);
  if (body.code !== 0) {
    const detail = body.message || body.msg || '';
    throw new Error(`B站接口 code ${body.code}${detail ? `: ${detail}` : ''}`);
  }
  return body.data;
}

function stripHtml(input: string): string {
  return (input || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function safe<T>(task: () => Promise<T>, warnings: string[], label: string): Promise<T | null> {
  try {
    return await task();
  } catch (err) {
    warnings.push(`${label}失败：${errorMessage(err)}`);
    return null;
  }
}

async function loadBuvid(): Promise<string> {
  return cached('spi:buvid', 30 * 60_000, async () => {
    const data = await apiGet<SpiData>('https://api.bilibili.com/x/frontend/finger/spi', 'https://www.bilibili.com/');
    return data.b_3 || '';
  });
}

/* ---------------- 登录态 Cookie + WBI 签名 ---------------- */

const WBI_MIXIN_TABLE = [
  46, 30, 38, 18, 29, 24, 40, 1, 32, 46, 20, 7, 35, 17, 35, 14, 23, 15, 36, 27, 12, 24, 17, 9, 32, 8, 37, 31, 19, 18,
  19, 16, 32, 36, 33, 32, 21, 25, 38, 20, 16, 14, 26, 20, 26, 9, 39, 32,
];

export interface BiliAuthOptions {
  /** 服务端使用的登录 Cookie（BILI_COOKIE） */
  cookie?: string;
  /** Cookie 里没有 DedeUserID 时，可手动指定 uid（BILI_UID） */
  uid?: string;
}

function readCookieValue(cookie: string, name: string): string {
  if (!cookie) return '';
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(cookie);
  return match ? decodeURIComponent(match[1]) : '';
}

function resolveCookie(options: BiliAuthOptions): string {
  const raw = (options.cookie ?? process.env.BILI_COOKIE ?? '').trim();
  if (!raw) return '';
  // 允许只填 SESSDATA 的值，而不是整段 Cookie
  if (!raw.includes('=')) return `SESSDATA=${raw}`;
  return raw;
}

function resolveUid(cookie: string, options: BiliAuthOptions): number {
  const fromCookie = Number.parseInt(readCookieValue(cookie, 'DedeUserID'), 10);
  if (Number.isFinite(fromCookie) && fromCookie > 0) return fromCookie;
  const manual = Number.parseInt(options.uid ?? process.env.BILI_UID ?? '', 10);
  return Number.isFinite(manual) && manual > 0 ? manual : 0;
}

function mixinKey(origin: string): string {
  return WBI_MIXIN_TABLE.map((index) => origin[index] ?? '').join('').slice(0, 32);
}

async function loadWbiKey(cookie: string): Promise<string> {
  const cacheKey = `wbi:${createHash('md5').update(cookie).digest('hex').slice(0, 8)}`;
  return cached(cacheKey, 20 * 60_000, async () => {
    const body = await apiJson<{ wbi_img?: { img_url?: string; sub_url?: string } }>(
      'https://api.bilibili.com/x/web-interface/nav',
      'https://www.bilibili.com/',
      cookie,
    );
    const imgUrl = body.data?.wbi_img?.img_url ?? '';
    const subUrl = body.data?.wbi_img?.sub_url ?? '';
    const img = imgUrl.split('/').pop()?.split('.')[0] ?? '';
    const sub = subUrl.split('/').pop()?.split('.')[0] ?? '';
    if (!img || !sub) throw new Error('nav 未返回可用的 wbi 密钥');
    return mixinKey(img + sub);
  });
}

function signedDanmuInfoUrl(roomId: number, key: string): string {
  const params: Record<string, string> = {
    id: String(roomId),
    type: '0',
    web_location: '444.8',
    wts: String(Math.floor(Date.now() / 1000)),
  };
  const query = Object.keys(params)
    .sort()
    .map((name) => `${encodeURIComponent(name)}=${encodeURIComponent(params[name])}`)
    .join('&');
  const wRid = createHash('md5').update(query + key).digest('hex');
  return `https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?${query}&w_rid=${wRid}`;
}

/** 用登录 Cookie 换取绑定 uid 的弹幕 token（WBI 签名失败时退回普通请求） */
async function fetchLoginDanmuInfo(roomId: number, cookie: string): Promise<DanmuInfoData> {
  const referer = `https://live.bilibili.com/${roomId}`;
  const errors: string[] = [];

  try {
    const key = await loadWbiKey(cookie);
    return await apiGet<DanmuInfoData>(signedDanmuInfoUrl(roomId, key), referer, cookie);
  } catch (error) {
    errors.push(`WBI 签名请求：${errorMessage(error)}`);
  }

  try {
    return await apiGet<DanmuInfoData>(
      `https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?id=${roomId}&type=0`,
      referer,
      cookie,
    );
  } catch (error) {
    errors.push(`普通请求：${errorMessage(error)}`);
  }

  throw new Error(errors.join('；'));
}

async function buildRoomBundle(input: number, refresh: boolean, auth: BiliAuthOptions): Promise<RoomBundle> {
  if (refresh) {
    for (const key of [...store.keys()]) {
      if (key.includes(`:${input}`)) store.delete(key);
    }
  }

  const warnings: string[] = [];
  const referer = `https://live.bilibili.com/${input}`;
  const cookie = resolveCookie(auth);
  const uid = resolveUid(cookie, auth);
  const buvidFromCookie = readCookieValue(cookie, 'buvid3');

  const init = await safe(
    () => cached(`init:${input}`, 10 * 60_000, () => apiGet<RoomInitData>(`https://api.live.bilibili.com/room/v1/Room/room_init?id=${input}`, referer)),
    warnings,
    '解析房间号',
  );

  const realId = init?.room_id ?? input;

  // 短号会映射到真实房间号，刷新时把真实房间相关缓存也清掉
  if (refresh) {
    for (const key of [...store.keys()]) {
      if (key.includes(`:${realId}`)) store.delete(key);
    }
  }

  const [info, anchor, conf, buvid, loginDanmu] = await Promise.all([
    safe(
      () => cached(`info:${realId}`, 20_000, () => apiGet<RoomInfoData>(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${realId}`, referer)),
      warnings,
      '获取房间信息',
    ),
    safe(
      () =>
        cached(`anchor:${realId}`, 10 * 60_000, () =>
          apiGet<AnchorInfoData>(`https://api.live.bilibili.com/live_user/v1/UserInfo/get_anchor_in_room?roomid=${realId}`, referer),
        ),
      warnings,
      '获取主播信息',
    ),
    safe(
      () =>
        cached(`conf:${realId}`, 60_000, () =>
          apiGet<DanmuConfData>(
            `https://api.live.bilibili.com/room/v1/Danmu/getConf?room_id=${realId}&platform=pc&player=web`,
            referer,
          ),
        ),
      warnings,
      '获取弹幕服务器配置',
    ),
    safe(loadBuvid, warnings, '获取 buvid'),
    cookie
      ? safe(
          () => cached(`danmuinfo:${realId}`, 60_000, () => fetchLoginDanmuInfo(realId, cookie)),
          warnings,
          '登录态获取弹幕 token',
        )
      : Promise.resolve(null as DanmuInfoData | null),
  ]);

  const room: RoomMeta = {
    roomId: realId,
    shortId: info?.short_id ?? init?.short_id ?? 0,
    title: info?.title || `房间 ${realId}`,
    cover: info?.user_cover || info?.keyframe || '',
    keyframe: info?.keyframe || '',
    upUid: anchor?.info?.uid ?? info?.uid ?? init?.uid ?? 0,
    upName: anchor?.info?.uname || '未知主播',
    upFace: anchor?.info?.face || '',
    liveStatus: info?.live_status ?? 0,
    liveTime: info?.live_time ?? '',
    areaName: info?.area_name || '',
    parentAreaName: info?.parent_area_name || '',
    attention: info?.attention ?? 0,
    online: info?.online ?? 0,
    description: stripHtml(info?.description || ''),
  };

  const hostList = loginDanmu?.host_list ?? conf?.host_server_list ?? [];
  const hosts = hostList
    .filter((host) => host && host.host)
    .slice(0, 8)
    .map((host) => ({
      host: host.host,
      port: host.port,
      wssPort: host.wss_port || 443,
    }));

  const token = loginDanmu?.token || conf?.token || '';
  const authUid = loginDanmu?.token ? uid : 0;
  const loggedIn = Boolean(loginDanmu?.token && authUid > 0);

  const danmaku: DanmakuCredentials = {
    token,
    buvid: buvidFromCookie || buvid || '',
    hosts,
    uid: authUid,
    loggedIn,
  };

  if (cookie && !uid) {
    warnings.push('BILI_COOKIE 中没有 DedeUserID，可额外配置 BILI_UID，否则只能以访客身份鉴权');
  }
  if (cookie && !loggedIn) {
    warnings.push('BILI_COOKIE 未能换到登录态 token（可能已过期或触发风控），本次以访客身份连接，部分昵称可能被打码');
  }
  if (!token) {
    warnings.push(
      '未获取到弹幕鉴权 token；可在 .env 配置 BILI_COOKIE（推荐）或手动配置 VITE_BILI_TOKEN / VITE_BILI_UID / VITE_BILI_BUVID',
    );
  }

  return { ok: true, fetchedAt: Date.now(), room, danmaku, warnings };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

type NextFn = (err?: unknown) => void;

export interface BilibiliApiOptions {
  /** 代理路径前缀，默认 /bili-api */
  prefix?: string;
  /** 服务端登录 Cookie（不会下发到浏览器） */
  cookie?: string;
  /** Cookie 缺少 DedeUserID 时使用的 uid */
  uid?: string;
}

export function bilibiliApiPlugin(options: BilibiliApiOptions = {}): Plugin {
  const prefix = normalizePrefix(options.prefix ?? '/bili-api');

  const middleware = (req: IncomingMessage, res: ServerResponse, next: NextFn) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) {
      next();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { ok: false, error: '仅支持 GET 请求' });
      return;
    }

    const action = url.pathname.slice(prefix.length).replace(/^\/+/, '');

    if (action === 'health') {
      sendJson(res, 200, { ok: true, ts: Date.now() });
      return;
    }

    if (action === 'room') {
      const raw = url.searchParams.get('roomId') ?? url.searchParams.get('id') ?? '';
      const roomId = Number.parseInt(raw, 10);
      if (!Number.isInteger(roomId) || roomId <= 0) {
        sendJson(res, 400, { ok: false, error: '房间号无效，请输入纯数字房间号或短号' });
        return;
      }
      const refresh = url.searchParams.get('refresh') === '1';
      buildRoomBundle(roomId, refresh, { cookie: options.cookie, uid: options.uid })
        .then((bundle) => sendJson(res, 200, bundle))
        .catch((err) => sendJson(res, 502, { ok: false, error: errorMessage(err) }));
      return;
    }

    sendJson(res, 404, { ok: false, error: `未知的接口：${action || '/'}` });
  };

  return {
    name: 'bili-live-api',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

function normalizePrefix(prefix: string): string {
  const trimmed = (prefix || '/bili-api').trim();
  const withLead = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingNoTrailing(withLead);
}

function withLeadingNoTrailing(value: string): string {
  return value.replace(/\/+$/, '') || '/bili-api';
}
