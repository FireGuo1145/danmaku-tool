/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 页面标题 */
  readonly VITE_APP_TITLE?: string;
  /** 本地 B 站接口代理前缀 */
  readonly VITE_BILI_API_BASE?: string;
  /** 默认房间号 */
  readonly VITE_DEFAULT_ROOM_ID?: string;
  /** 是否在打开页面后自动连接（true / false） */
  readonly VITE_AUTO_CONNECT?: string;
  /** 可选：登录态 uid，配合 VITE_BILI_TOKEN 使用 */
  readonly VITE_BILI_UID?: string;
  /** 可选：手动指定 buvid（b_3） */
  readonly VITE_BILI_BUVID?: string;
  /** 可选：手动指定弹幕鉴权 token */
  readonly VITE_BILI_TOKEN?: string;
  /** 弹幕协议版本：1 不压缩 / 2 zlib（推荐） */
  readonly VITE_PROTOVER?: string;
  /** 消息列表最多保留条数 */
  readonly VITE_MAX_MESSAGES?: string;
  /** 是否显示进场消息 */
  readonly VITE_SHOW_ENTER?: string;
  /** 是否显示点赞消息 */
  readonly VITE_SHOW_LIKE?: string;
  /** 礼物浮层提示的最小金瓜子价值 */
  readonly VITE_GIFT_TOAST_MIN?: string;
  /** 是否默认进入演示模式 */
  readonly VITE_DEMO_MODE?: string;
  /** 首页快捷房间号，逗号分隔 */
  readonly VITE_QUICK_ROOMS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
