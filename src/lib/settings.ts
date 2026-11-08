import { config } from '../config';

export interface Settings {
  roomId: number;
  autoConnect: boolean;
  showEnter: boolean;
  showLike: boolean;
  maxMessages: number;
  fontSize: number;
  demo: boolean;
  giftToastMin: number;
}

const STORAGE_KEY = 'bili-danmaku:settings:v1';

export function defaultSettings(): Settings {
  return {
    roomId: config.defaultRoomId,
    autoConnect: config.autoConnect,
    showEnter: config.showEnter,
    showLike: config.showLike,
    maxMessages: config.maxMessages,
    fontSize: 14,
    demo: config.demoMode,
    giftToastMin: config.giftToastMin,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStored(): Partial<Settings> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return parsed as Partial<Settings>;
  } catch {
    return {};
  }
}

/** 读取设置：env 默认值 → localStorage → URL 查询参数（优先级最高） */
export function loadSettings(): Settings {
  const base = defaultSettings();
  const stored = readStored();

  const merged: Settings = {
    roomId: Number.isInteger(stored.roomId) && Number(stored.roomId) > 0 ? Number(stored.roomId) : base.roomId,
    autoConnect: typeof stored.autoConnect === 'boolean' ? stored.autoConnect : base.autoConnect,
    showEnter: typeof stored.showEnter === 'boolean' ? stored.showEnter : base.showEnter,
    showLike: typeof stored.showLike === 'boolean' ? stored.showLike : base.showLike,
    maxMessages:
      Number.isInteger(stored.maxMessages) && Number(stored.maxMessages) >= 50
        ? Math.min(2000, Number(stored.maxMessages))
        : base.maxMessages,
    fontSize: Number.isInteger(stored.fontSize) && Number(stored.fontSize) >= 12 ? Math.min(22, Number(stored.fontSize)) : base.fontSize,
    // 演示模式偏向「临时预览」，不写入本地存储，避免下次打开误以为连上了真实房间
    demo: base.demo,
    giftToastMin:
      Number.isInteger(stored.giftToastMin) && Number(stored.giftToastMin) >= 0
        ? Number(stored.giftToastMin)
        : base.giftToastMin,
  };

  try {
    const params = new URLSearchParams(window.location.search);
    const roomParam = Number.parseInt(params.get('room') ?? '', 10);
    if (Number.isInteger(roomParam) && roomParam > 0) merged.roomId = roomParam;
    if (params.get('demo') === '1') merged.demo = true;
    if (params.get('demo') === '0') merged.demo = false;
  } catch {
    // ignore
  }

  return merged;
}

export function saveSettings(settings: Settings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 隐私模式下可能写入失败，忽略即可
  }
}

export function clearStoredSettings(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
