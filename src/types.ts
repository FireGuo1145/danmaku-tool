/** 全局事件与状态类型 */

export type GuardLevel = 0 | 1 | 2 | 3;

export interface Medal {
  name: string;
  level: number;
  /** 文本颜色 */
  color: string;
  guardLevel: GuardLevel;
}

export interface LiveUser {
  uid: string;
  name: string;
  face?: string;
  medal?: Medal;
  guardLevel: GuardLevel;
  isAdmin?: boolean;
}

export interface BaseEvent {
  id: string;
  ts: number;
}

export interface DanmakuEmote {
  url: string;
  width: number;
  height: number;
}

export interface DanmakuEvent extends BaseEvent {
  kind: 'danmaku';
  user: LiveUser;
  text: string;
  color: string;
  /** 1 普通 / 4 底部 / 5 顶部 */
  mode: number;
  /** 大表情（dm_type = 1）图片地址 */
  emoticon?: string;
  /** B 站小表情：文字里的 [表情名] → 图片 */
  emotes?: Record<string, DanmakuEmote>;
}

export interface GiftEvent extends BaseEvent {
  kind: 'gift';
  user: LiveUser;
  giftId: number;
  giftName: string;
  num: number;
  /** 单价（金瓜子 / 银瓜子） */
  price: number;
  coinType: 'gold' | 'silver';
  /** 总价值（金瓜子 / 银瓜子） */
  totalCoin: number;
  comboId?: string;
  comboNum?: number;
  action: string;
  icon?: string;
}

export interface SuperChatEvent extends BaseEvent {
  kind: 'superchat';
  user: LiveUser;
  text: string;
  /** 单位：元 */
  price: number;
  color?: string;
}

export interface GuardEvent extends BaseEvent {
  kind: 'guard';
  user: LiveUser;
  level: GuardLevel;
  guardName: string;
  num: number;
  /** 单价，单位：金瓜子 */
  price: number;
}

export interface EnterEvent extends BaseEvent {
  kind: 'enter';
  user: LiveUser;
  msgType: number;
  label?: string;
}

export interface LikeEvent extends BaseEvent {
  kind: 'like';
  user: LiveUser;
  text: string;
}

export interface SystemEvent extends BaseEvent {
  kind: 'system';
  text: string;
  tone: 'info' | 'live' | 'warn';
}

export type FeedEvent = DanmakuEvent | GiftEvent | SuperChatEvent | GuardEvent | EnterEvent | LikeEvent | SystemEvent;

export type FeedKind = FeedEvent['kind'];

export interface RoomStats {
  /** 人气值 */
  popularity: number;
  /** 累计看过 */
  watched: number;
  /** 点赞总数 */
  likes: number;
  /** 高能用户数 */
  onlineRank: number;
  /** 粉丝数 */
  fans: number;
  /** 本场收到的弹幕条数 */
  danmaku: number;
  /** 礼物个数 */
  giftCount: number;
  /** 礼物总价值（金瓜子） */
  giftGold: number;
  /** 免费礼物总价值（银瓜子） */
  giftSilver: number;
  /** 醒目留言条数 */
  scCount: number;
  /** 醒目留言总金额（元） */
  scAmount: number;
  /** 上舰次数 */
  guardCount: number;
  /** 进场人数（去重前的次数） */
  enterCount: number;
}

export interface GiftRank {
  uid: string;
  name: string;
  face?: string;
  gold: number;
  silver: number;
  count: number;
  lastTs: number;
}

export interface GiftToast {
  id: string;
  user: LiveUser;
  giftName: string;
  num: number;
  coinType: 'gold' | 'silver';
  gold: number;
  icon?: string;
}

export type ConnectionStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'closed' | 'error';

export type FeedFilter = 'all' | 'danmaku' | 'gift' | 'superchat' | 'guard' | 'enter';
