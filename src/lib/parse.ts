import type {
  DanmakuEmote,
  DanmakuEvent,
  EnterEvent,
  FeedEvent,
  GiftEvent,
  GuardEvent,
  GuardLevel,
  LikeEvent,
  LiveUser,
  Medal,
  RoomStats,
  SuperChatEvent,
  SystemEvent,
} from '../types';
import { guardLabel, stripTags } from './format';
import { decodeProtobuf, fromBase64, pbMessage, pbNumber, pbString } from './protobuf';

/** 一条原始消息解析后的产物 */
export interface ParsedCommand {
  /** 需要展示在弹幕流里的事件 */
  feed?: FeedEvent;
  /** 房间维度的统计数据更新 */
  stats?: Partial<RoomStats>;
  /** 直播状态变化 */
  live?: 'live' | 'idle';
}

let sequence = 0;

function nextId(prefix: string): string {
  sequence = (sequence + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}

function toGuardLevel(value: unknown): GuardLevel {
  const level = Number(value);
  return level === 1 || level === 2 || level === 3 ? level : 0;
}

function normalizeUrl(value: string): string {
  return value.startsWith('http://') ? `https://${value.slice('http://'.length)}` : value;
}

function hexColor(value: unknown): string {
  if (typeof value === 'string') {
    const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value.trim());
    if (match) return `#${match[1].toLowerCase()}`;
  }
  const numeric = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(numeric) || numeric < 0) return '#ffffff';
  return `#${(numeric & 0xffffff).toString(16).padStart(6, '0')}`;
}

function medalFrom(raw: unknown): Medal | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const name = String(source.name ?? source.medal_name ?? '').trim();
  const level = Number(source.level ?? source.medal_level ?? 0);
  if (!name && !level) return undefined;
  const colorSource = source.v2_medal_color_text ?? source.color ?? source.medal_color;
  return {
    name: name || '粉丝牌',
    level: Number.isFinite(level) ? level : 0,
    color: hexColor(colorSource),
    guardLevel: toGuardLevel(source.guard_level),
  };
}

interface LegacyUserInput {
  uid?: unknown;
  name?: unknown;
  face?: unknown;
  medal?: unknown;
  guard?: unknown;
}

function userFromLegacy(input: LegacyUserInput): LiveUser {
  const name = String(input.name ?? '').trim();
  return {
    uid: String(input.uid ?? ''),
    name: name || '匿名用户',
    face: typeof input.face === 'string' && input.face ? input.face : undefined,
    medal: medalFrom(input.medal),
    guardLevel: toGuardLevel(input.guard),
  };
}

/** 解析新版 uinfo：{ uid, base: { name, face }, medal, guard } */
function userFromUinfo(raw: unknown): LiveUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, any>;
  const base = source.base ?? {};
  const name = String(base.name ?? source.uname ?? source.name ?? '').trim();
  if (!name) return null;
  return {
    uid: String(source.uid ?? base.uid ?? ''),
    name,
    face: typeof base.face === 'string' && base.face ? base.face : undefined,
    medal: medalFrom(source.medal),
    guardLevel: toGuardLevel(source.guard?.level ?? source.guard_level),
  };
}

function parseDanmaku(payload: any): ParsedCommand | null {
  const info: any[] = Array.isArray(payload?.info) ? payload.info : [];
  const meta: any[] = Array.isArray(info[0]) ? info[0] : [];

  // 新版本把发送者信息塞进了 info[0][15].extra 的 JSON 字符串里
  let extra: any = null;
  const rawExtra = meta[15]?.extra;
  if (typeof rawExtra === 'string' && rawExtra.startsWith('{')) {
    try {
      extra = JSON.parse(rawExtra);
    } catch {
      extra = null;
    }
  }

  // 新版把发送者对象直接放在 info[0][15].user，老版本在 extra.user 里
  const user =
    userFromUinfo(meta[15]?.user) ??
    userFromUinfo(extra?.user) ??
    userFromLegacy({
      uid: info[2]?.[0],
      name: info[2]?.[1],
      medal: info[3]?.[1] ? { level: info[3][0], name: info[3][1], color: info[3][3] } : undefined,
      guard: info[2]?.[7],
    });
  user.isAdmin = info[2]?.[2] === 1;

  const text = String(extra?.content ?? info[1] ?? '').trim();
  if (!text) return null;

  // 大表情信息在 meta[13]（老版本在 meta[12]），形如 { url, width, height, emoticon_unique }
  const emoticonMeta = [meta[13], meta[12]].find(
    (item) => item && typeof item === 'object' && typeof (item as any).url === 'string' && /^https?:/.test((item as any).url),
  ) as { url: string } | undefined;
  const emoticon = emoticonMeta?.url ? normalizeUrl(emoticonMeta.url) : undefined;

  // B 站小表情：extra.emots 是 { "[狗头]": { url, width, height, ... } } 形式的映射
  const rawEmots = extra?.emots;
  let emotes: Record<string, DanmakuEmote> | undefined;
  if (rawEmots && typeof rawEmots === 'object') {
    const map: Record<string, DanmakuEmote> = {};
    for (const [token, value] of Object.entries(rawEmots)) {
      const emote = value as { url?: unknown; width?: unknown; height?: unknown } | null;
      if (!emote || typeof emote.url !== 'string' || !emote.url) continue;
      map[token] = {
        url: normalizeUrl(emote.url),
        width: Number(emote.width) || 20,
        height: Number(emote.height) || 20,
      };
    }
    if (Object.keys(map).length > 0) emotes = map;
  }

  const event: DanmakuEvent = {
    id: nextId('dm'),
    ts: Date.now(),
    kind: 'danmaku',
    user,
    text,
    color: hexColor(extra?.color ?? meta[3]),
    mode: Number(extra?.mode ?? meta[1] ?? 1),
    emoticon,
    emotes,
  };

  return { feed: event };
}

function parseGiftLegacy(payload: any): ParsedCommand | null {
  const data = payload?.data;
  if (!data) return null;
  const giftName = String(data.giftName ?? data.gift_name ?? '').trim();
  if (!giftName) return null;

  const num = Math.max(1, Number(data.num) || 1);
  const price = Math.max(0, Number(data.price) || 0);
  const coinType: 'gold' | 'silver' = data.coin_type === 'silver' ? 'silver' : 'gold';

  const event: GiftEvent = {
    id: nextId('gift'),
    ts: Date.now(),
    kind: 'gift',
    user: userFromLegacy({
      uid: data.uid,
      name: data.uname,
      face: data.face,
      medal: data.medal_info,
      guard: data.guard_level,
    }),
    giftId: Number(data.giftId ?? data.gift_id) || 0,
    giftName,
    num,
    price,
    coinType,
    totalCoin: Number(data.total_coin) || price * num,
    comboId: String(data.batch_combo_id ?? data.combo_id ?? '') || undefined,
    comboNum: Number(data.batch_combo_num ?? data.combo_num) || num,
    action: String(data.action ?? '投喂'),
    icon: data.gift_info?.img_basic || data.gift_info?.webp || undefined,
  };

  return { feed: event };
}

/** 新版礼物事件：data.pb 是 protobuf 编码的 SendGift */
function parseGiftV2(payload: any): ParsedCommand | null {
  const data = payload?.data;
  if (!data?.pb) return parseGiftLegacy(payload);

  const pb = decodeProtobuf(fromBase64(String(data.pb)));
  const gift = pbMessage(pb, 10);
  if (!gift) return parseGiftLegacy(payload);

  const uinfo = pbMessage(pb, 15);
  const medal = pbMessage(uinfo, 3);
  const base = pbMessage(uinfo, 2);
  const guardInfo = pbMessage(uinfo, 4);

  const num = Math.max(1, pbNumber(pb, 11) || 1);
  const price = pbNumber(gift, 6) || pbNumber(gift, 5);
  const coinType: 'gold' | 'silver' = pbString(gift, 8) === 'silver' ? 'silver' : 'gold';
  const images = pbMessage(pb, 35);

  const event: GiftEvent = {
    id: nextId('gift'),
    ts: Date.now(),
    kind: 'gift',
    user: {
      uid: String(pbNumber(pb, 1) || data.uid || ''),
      name: pbString(pb, 2) || pbString(base, 1) || '匿名用户',
      face: pbString(pb, 3) || pbString(base, 2) || undefined,
      medal: medal
        ? medalFrom({
            name: pbString(medal, 1),
            level: pbNumber(medal, 2),
            color: pbNumber(medal, 3),
            v2_medal_color_text: pbString(medal, 15),
          })
        : undefined,
      guardLevel: toGuardLevel(pbNumber(guardInfo, 1)),
    },
    giftId: pbNumber(gift, 1),
    giftName: pbString(gift, 2) || '礼物',
    num,
    price,
    coinType,
    totalCoin: pbNumber(gift, 14) || price * num,
    comboId: pbString(gift, 12) || undefined,
    comboNum: pbNumber(gift, 13) || num,
    action: pbString(gift, 18) || '投喂',
    icon: images ? pbString(images, 2) || pbString(images, 1) || undefined : undefined,
  };

  return { feed: event };
}

function parseSuperChat(payload: any): ParsedCommand {
  const data = payload?.data ?? {};
  const info = data.user_info ?? {};
  const event: SuperChatEvent = {
    id: nextId('sc'),
    ts: Date.now(),
    kind: 'superchat',
    user: userFromLegacy({
      uid: info.uid ?? data.uid,
      name: info.uname,
      face: info.face,
      medal: info.medal_info ?? data.medal_info,
      guard: info.guard_level,
    }),
    text: String(data.message ?? data.message_trans ?? '').trim(),
    price: Math.max(0, Number(data.price) || 0),
    color: typeof data.background_price_color === 'string' ? data.background_price_color : undefined,
  };
  return { feed: event };
}

function parseGuard(payload: any): ParsedCommand {
  const data = payload?.data ?? {};
  const level = toGuardLevel(data.guard_level);
  const event: GuardEvent = {
    id: nextId('guard'),
    ts: Date.now(),
    kind: 'guard',
    user: userFromLegacy({ uid: data.uid, name: data.username ?? data.uname, guard: level }),
    level,
    guardName: String(data.gift_name || guardLabel(level) || '大航海'),
    num: Math.max(1, Number(data.num) || 1),
    price: Math.max(0, Number(data.price) || 0),
  };
  return { feed: event };
}

function enterLabel(msgType: number): string | undefined {
  switch (msgType) {
    case 2:
      return '关注了主播';
    case 3:
      return '分享了直播间';
    case 4:
      return '特别关注了主播';
    default:
      return undefined;
  }
}

/** 新版进场事件：data.pb 是 protobuf 编码的 InteractWord */
function parseInteractV2(payload: any): ParsedCommand | null {
  const pbRaw = payload?.data?.pb;
  if (!pbRaw) return null;
  const pb = decodeProtobuf(fromBase64(String(pbRaw)));
  const uinfo = pbMessage(pb, 22);
  const base = pbMessage(uinfo, 2);
  const medal = pbMessage(uinfo, 3);
  const guard = pbMessage(uinfo, 4);
  const name = pbString(base, 1) || pbString(pb, 2);
  if (!name) return null;

  const msgType = pbNumber(pb, 5) || 1;
  const event: EnterEvent = {
    id: nextId('enter'),
    ts: Date.now(),
    kind: 'enter',
    user: {
      uid: String(pbNumber(uinfo, 1) || pbNumber(pb, 1) || ''),
      name,
      face: pbString(base, 2) || undefined,
      medal: medal
        ? medalFrom({
            name: pbString(medal, 1),
            level: pbNumber(medal, 2),
            color: pbString(medal, 19) || pbNumber(medal, 3),
            v2_medal_color_text: pbString(medal, 19),
            guard_level: pbNumber(guard, 1),
          })
        : undefined,
      guardLevel: toGuardLevel(pbNumber(guard, 1) || pbNumber(uinfo, 4)),
    },
    msgType,
    label: enterLabel(msgType),
  };
  return { feed: event };
}

function parseInteract(payload: any): ParsedCommand | null {
  const data = payload?.data;
  if (!data) return null;
  const name = String(data.uname ?? '').trim();
  if (!name) return null;
  const msgType = Number(data.msg_type) || 1;
  const event: EnterEvent = {
    id: nextId('enter'),
    ts: Date.now(),
    kind: 'enter',
    user: userFromLegacy({ uid: data.uid, name, face: data.face, medal: data.fans_medal, guard: data.guard_level }),
    msgType,
    label: enterLabel(msgType),
  };
  return { feed: event };
}

function parseEntryEffect(payload: any): ParsedCommand | null {
  const data = payload?.data;
  if (!data) return null;
  const user =
    userFromUinfo(data.uinfo) ??
    userFromLegacy({ uid: data.uid, name: String(data.copy_writing ?? '').replace(/<%|%>/g, '').trim() });

  const label = stripTags(String(data.copy_writing ?? '')).replace(/<%|%>/g, '').trim() || `${user.name} 来了`;
  const event: EnterEvent = {
    id: nextId('enter'),
    ts: Date.now(),
    kind: 'enter',
    user,
    msgType: 1,
    label,
  };
  return { feed: event };
}

function parseLike(payload: any): ParsedCommand | null {
  const data = payload?.data;
  if (!data) return null;
  const user = userFromUinfo(data.uinfo) ?? userFromLegacy({ uid: data.uid, name: data.uname });
  const event: LikeEvent = {
    id: nextId('like'),
    ts: Date.now(),
    kind: 'like',
    user,
    text: String(data.like_text ?? '为主播点赞了'),
  };
  return { feed: event };
}

function systemEvent(text: string, tone: SystemEvent['tone'] = 'info'): ParsedCommand {
  return {
    feed: { id: nextId('sys'), ts: Date.now(), kind: 'system', text, tone },
  };
}

function readNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * 把 bilibili-ws-client 收到的原始消息转换成统一事件。
 * @param rawCmd 原始 cmd，可能会带后缀，例如 DANMU_MSG:4:0:2:2:2:0
 */
export function parseCommand(rawCmd: string, payload: any): ParsedCommand | null {
  const cmd = String(rawCmd || '').split(':')[0].toUpperCase();

  switch (cmd) {
    case 'DANMU_MSG':
      return parseDanmaku(payload);

    case 'SEND_GIFT':
      return parseGiftLegacy(payload);

    case 'SEND_GIFT_V2':
      return parseGiftV2(payload);

    // COMBO_SEND 是连击汇总，SEND_GIFT 已经带上了连击数，忽略避免重复计数
    case 'COMBO_SEND':
      return null;

    case 'SUPER_CHAT_MESSAGE':
      return parseSuperChat(payload);

    case 'SUPER_CHAT_MESSAGE_DELETE':
      return systemEvent('一条醒目留言已被删除', 'warn');

    case 'GUARD_BUY':
      return parseGuard(payload);

    case 'INTERACT_WORD':
      return parseInteract(payload);

    case 'INTERACT_WORD_V2':
      return parseInteractV2(payload);

    case 'ENTRY_EFFECT':
      return parseEntryEffect(payload);

    case 'LIKE_INFO_V3_CLICK':
      return parseLike(payload);

    case 'WATCHED_CHANGE': {
      const watched = readNumber(payload?.data?.num);
      return watched === null ? null : { stats: { watched } };
    }

    case 'POPULARITY_CHANGE': {
      const popularity = readNumber(payload?.data?.popularity);
      return popularity === null ? null : { stats: { popularity } };
    }

    case 'LIKE_INFO_V3_UPDATE': {
      const likes = readNumber(payload?.data?.click_count);
      return likes === null ? null : { stats: { likes } };
    }

    case 'ONLINE_RANK_COUNT': {
      const count = readNumber(payload?.data?.count ?? payload?.data?.online_count);
      return count === null ? null : { stats: { onlineRank: count } };
    }

    case 'ROOM_REAL_TIME_MESSAGE_UPDATE': {
      const fans = readNumber(payload?.data?.fans);
      return fans === null ? null : { stats: { fans } };
    }

    case 'LIVE': {
      const result = systemEvent('主播开播了，欢迎来到直播间 🎉', 'live');
      return { ...result, live: 'live' };
    }

    case 'PREPARING': {
      const result = systemEvent('主播下播了，直播间进入休息状态', 'warn');
      return { ...result, live: 'idle' };
    }

    case 'ROOM_CHANGE': {
      const title = String(payload?.data?.title ?? '').trim();
      return systemEvent(title ? `直播间标题修改为「${title}」` : '直播间信息已更新');
    }

    case 'NOTICE_MSG': {
      const data = payload?.data ?? {};
      const text = stripTags(String(data.msg_common ?? data.msg_self ?? data.msg ?? ''));
      return text ? systemEvent(text) : null;
    }

    case 'COMMON_NOTICE_DANMAKU': {
      const segments: any[] = Array.isArray(payload?.data?.content_segments) ? payload.data.content_segments : [];
      const text = stripTags(segments.map((segment) => String(segment?.text ?? '')).join(''));
      return text ? systemEvent(text) : null;
    }

    case 'ANCHOR_LOT_START': {
      const award = stripTags(String(payload?.data?.award_name ?? ''));
      return systemEvent(award ? `天选时刻来啦：${award}` : '天选时刻来啦');
    }

    case 'WARNING':
      return systemEvent('收到直播间警告，请遵守弹幕礼仪', 'warn');

    case 'CUT_OFF':
      return systemEvent('直播已被切断', 'warn');

    default:
      return null;
  }
}

/** 生成一条系统提示事件（连接状态等） */
export function systemMessage(text: string, tone: SystemEvent['tone'] = 'info'): SystemEvent {
  return { id: nextId('sys'), ts: Date.now(), kind: 'system', text, tone };
}
