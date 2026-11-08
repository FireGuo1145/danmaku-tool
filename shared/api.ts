/** 前后端共享的接口类型 */

export interface RoomMeta {
  /** 真实房间号（短号会自动转换） */
  roomId: number;
  /** 短号，未设置时为 0 */
  shortId: number;
  title: string;
  cover: string;
  keyframe: string;
  upUid: number;
  upName: string;
  upFace: string;
  /** 1 直播中 / 2 轮播 / 0 未开播 */
  liveStatus: number;
  liveTime: string;
  areaName: string;
  parentAreaName: string;
  attention: number;
  online: number;
  description: string;
}

export interface DanmakuCredentials {
  /** 通过 B 站接口拿到的弹幕服务器鉴权 token */
  token: string;
  /** b_3 buvid，访客标识 */
  buvid: string;
  /** B 站返回的弹幕服务器列表 */
  hosts: Array<{ host: string; port: number; wssPort: number }>;
  /** 服务端从 BILI_COOKIE 识别出的登录 uid，访客为 0 */
  uid: number;
  /** 是否成功用登录态换到了弹幕 token */
  loggedIn: boolean;
}

export interface RoomBundle {
  ok: true;
  fetchedAt: number;
  room: RoomMeta;
  danmaku: DanmakuCredentials;
  warnings: string[];
}

export interface ApiFailure {
  ok: false;
  error: string;
}
