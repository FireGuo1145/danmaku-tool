import type { ApiFailure, RoomBundle } from '../../shared/api';
import { config } from '../config';

/** 通过本地代理获取房间元信息 + 弹幕连接凭据 */
export async function fetchRoomBundle(roomId: number, refresh = false): Promise<RoomBundle> {
  const query = `roomId=${encodeURIComponent(roomId)}${refresh ? '&refresh=1' : ''}`;
  const response = await fetch(`${config.apiBase}/room?${query}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let payload: RoomBundle | ApiFailure | null = null;
  try {
    payload = JSON.parse(text) as RoomBundle | ApiFailure;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.ok !== true) {
    const reason = payload && payload.ok === false ? payload.error : `HTTP ${response.status}`;
    throw new Error(reason || '获取直播间信息失败');
  }

  return payload;
}

export async function pingProxy(): Promise<boolean> {
  try {
    const response = await fetch(`${config.apiBase}/health`, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return false;
    const payload = (await response.json()) as { ok?: boolean };
    return payload.ok === true;
  } catch {
    return false;
  }
}
