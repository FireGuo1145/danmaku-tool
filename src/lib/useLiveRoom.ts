import Client from 'bilibili-ws-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomBundle, RoomMeta } from '../../shared/api';
import { config } from '../config';
import type { ConnectionStatus, FeedEvent, GiftEvent, GiftRank, GiftToast, RoomStats } from '../types';
import { fetchRoomBundle } from './api';
import { startDemoStream } from './demo';
import { appendEvents, rankGifts } from './feed';
import { parseCommand, systemMessage } from './parse';

const RATE_WINDOW = 45;
const MAX_ATTEMPTS = 8;

export const emptyStats: RoomStats = {
  popularity: 0,
  watched: 0,
  likes: 0,
  onlineRank: 0,
  fans: 0,
  danmaku: 0,
  giftCount: 0,
  giftGold: 0,
  giftSilver: 0,
  scCount: 0,
  scAmount: 0,
  guardCount: 0,
  enterCount: 0,
};

const DEMO_ROOM: RoomMeta = {
  roomId: 3947892,
  shortId: 0,
  title: '【演示】夏日歌会 · 一起听歌聊天',
  cover: 'https://i0.hdslb.com/bfs/live/new_room_cover/5f3afa6919662e7ae7c77da9ae3ffab982dcf56d.jpg',
  keyframe: '',
  upUid: 84130356,
  upName: '夏天y',
  upFace: 'https://i0.hdslb.com/bfs/face/2139ba40f33a5977675e209a66896c4c3fe3eeb5.jpg',
  liveStatus: 1,
  liveTime: '',
  areaName: '唱见',
  parentAreaName: '娱乐',
  attention: 482_000,
  online: 12_345,
  description: '演示模式：以下内容由本地回放生成，不会连接 B 站服务器。',
};

export interface LiveRoomOptions {
  maxMessages: number;
  demo: boolean;
}

export interface ConnectionInfo {
  protocol: number;
  hasToken: boolean;
  hasBuvid: boolean;
  /** 鉴权使用的 uid：0 表示访客 */
  uid: number;
  demo: boolean;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '未知错误';
}

export function useLiveRoom(options: LiveRoomOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [room, setRoom] = useState<RoomMeta | null>(null);
  const [messages, setMessages] = useState<FeedEvent[]>([]);
  const [stats, setStats] = useState<RoomStats>(emptyStats);
  const [gifts, setGifts] = useState<GiftRank[]>([]);
  const [rate, setRate] = useState<number[]>(() => new Array(RATE_WINDOW).fill(0));
  const [toasts, setToasts] = useState<GiftToast[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [lastEventAt, setLastEventAt] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [liveStatus, setLiveStatus] = useState(0);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null);

  const maxMessagesRef = useRef(options.maxMessages);
  const demoRef = useRef(options.demo);
  useEffect(() => {
    maxMessagesRef.current = options.maxMessages;
    demoRef.current = options.demo;
  }, [options.maxMessages, options.demo]);

  const clientRef = useRef<Client | null>(null);
  const generationRef = useRef(0);
  const desiredRef = useRef(false);
  const roomIdRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const demoStopRef = useRef<(() => void) | null>(null);

  const bufferRef = useRef<FeedEvent[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const statsRef = useRef<RoomStats>({ ...emptyStats });
  const statDirtyRef = useRef(false);
  const giftMapRef = useRef<Map<string, GiftRank>>(new Map());
  const giftDirtyRef = useRef(false);
  const lastEventRef = useRef(0);
  const rateRef = useRef({ second: Math.floor(Date.now() / 1000), slots: new Array(RATE_WINDOW).fill(0) });
  const toastTimersRef = useRef<Set<number>>(new Set());
  /** 上次鉴权重连时间，用于限流 */
  const lastAuthRef = useRef(0);
  /** 当前是否访客连接（uid = 0） */
  const guestRef = useRef(false);
  /** 近期被打码的昵称计数，用于发现服务端脱敏 */
  const maskedRef = useRef({ count: 0, since: 0 });

  const teardown = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    demoStopRef.current?.();
    demoStopRef.current = null;

    const client = clientRef.current;
    clientRef.current = null;
    if (client) {
      try {
        client.close();
      } catch {
        // 已经断开时忽略
      }
    }

    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    for (const timer of toastTimersRef.current) window.clearTimeout(timer);
    toastTimersRef.current.clear();
  }, []);

  const flush = useCallback(() => {
    flushTimerRef.current = null;

    const incoming = bufferRef.current;
    bufferRef.current = [];
    if (incoming.length > 0) {
      setMessages((previous) => appendEvents(previous, incoming, maxMessagesRef.current));
    }
    if (statDirtyRef.current) {
      statDirtyRef.current = false;
      setStats({ ...statsRef.current });
    }
    if (giftDirtyRef.current) {
      giftDirtyRef.current = false;
      setGifts(rankGifts(giftMapRef.current));
    }
    if (lastEventRef.current > 0) {
      setLastEventAt(lastEventRef.current);
      lastEventRef.current = 0;
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(flush, 120);
  }, [flush]);

  const bumpRate = useCallback(() => {
    const state = rateRef.current;
    const nowSecond = Math.floor(Date.now() / 1000);
    if (nowSecond < state.second) {
      state.second = nowSecond;
    }
    while (state.second < nowSecond) {
      state.slots.push(0);
      if (state.slots.length > RATE_WINDOW) state.slots.shift();
      state.second += 1;
    }
    state.slots[state.slots.length - 1] += 1;
  }, []);

  const pushToast = useCallback((gift: GiftEvent) => {
    if (gift.coinType !== 'gold') return;
    const gold = gift.price * gift.num;
    if (gold < config.giftToastMin) return;
    const toast: GiftToast = {
      id: gift.id,
      user: gift.user,
      giftName: gift.giftName,
      num: gift.num,
      coinType: gift.coinType,
      gold,
      icon: gift.icon,
    };
    setToasts((previous) => [...previous.slice(-2), toast]);
    const timer = window.setTimeout(() => {
      toastTimersRef.current.delete(timer);
      setToasts((previous) => previous.filter((item) => item.id !== toast.id));
    }, 4600);
    toastTimersRef.current.add(timer);
  }, []);

  const connectRef = useRef<((roomId: number, mode: 'fresh' | 'retry') => void) | null>(null);

  /**
   * 软重连：保留消息，重新拉取 token 并重连。
   *
   * B 站对未登录的访客会话运行一段时间后，会开始把弹幕里的用户信息脱敏（昵称变成 `取***`），
   * 重新鉴权就能恢复。这里用于定期刷新凭证，以及检测到批量打码时自救。
   */
  const softReauth = useCallback((reason: string) => {
    // 登录态（BILI_COOKIE / 手动 uid+token）不会被打码，也不需要自动重连
    if (!desiredRef.current || demoRef.current || !guestRef.current) return;
    const now = Date.now();
    if (now - lastAuthRef.current < 4 * 60_000) return; // 至少间隔 4 分钟，避免频繁重连
    const targetRoom = roomIdRef.current;
    if (!targetRoom) return;
    lastAuthRef.current = now;
    maskedRef.current = { count: 0, since: 0 };
    console.info(`[弹幕台] ${reason}，正在重新鉴权…`);
    connectRef.current?.(targetRoom, 'retry');
  }, []);

  /** 处理一条解析后的直播事件 */
  const applyParsed = useCallback(
    (cmd: string, payload: unknown) => {
      const parsed = parseCommand(cmd, payload);
      if (!parsed) return;

      if (parsed.stats) {
        let statsChanged = false;
        for (const [key, value] of Object.entries(parsed.stats)) {
          if (typeof value !== 'number' || !Number.isFinite(value)) continue;
          const typedKey = key as keyof RoomStats;
          if (statsRef.current[typedKey] !== value) {
            statsRef.current[typedKey] = value;
            statsChanged = true;
          }
        }
        if (statsChanged) statDirtyRef.current = true;
      }

      if (parsed.live) setLiveStatus(parsed.live === 'live' ? 1 : 0);

      const feed = parsed.feed;
      if (!feed) return;

      lastEventRef.current = feed.ts;
      bufferRef.current.push(feed);
      bumpRate();

      switch (feed.kind) {
        case 'danmaku': {
          statsRef.current.danmaku += 1;
          statDirtyRef.current = true;

          // 访客连接跑久了 B 站会开始脱敏昵称，短时间内出现一批 `取***` 就重新鉴权
          if (guestRef.current && feed.user.name.includes('*')) {
            const now = Date.now();
            if (now - maskedRef.current.since > 3 * 60_000) {
              maskedRef.current = { count: 0, since: now };
            }
            maskedRef.current.count += 1;
            if (maskedRef.current.count >= 6) {
              maskedRef.current = { count: 0, since: now };
              softReauth('检测到昵称被批量打码');
            }
          }
          break;
        }
        case 'gift': {
          const silver = feed.coinType === 'silver' ? feed.price * feed.num : 0;
          const gold = feed.coinType === 'gold' ? feed.price * feed.num : 0;
          statsRef.current.giftCount += feed.num;
          statsRef.current.giftGold += gold;
          statsRef.current.giftSilver += silver;
          statDirtyRef.current = true;

          const key = feed.user.uid || feed.user.name;
          const existing = giftMapRef.current.get(key);
          if (existing) {
            existing.gold += gold;
            existing.silver += silver;
            existing.count += feed.num;
            existing.lastTs = feed.ts;
            existing.name = feed.user.name;
            existing.face = feed.user.face ?? existing.face;
          } else {
            giftMapRef.current.set(key, {
              uid: feed.user.uid,
              name: feed.user.name,
              face: feed.user.face,
              gold,
              silver,
              count: feed.num,
              lastTs: feed.ts,
            });
          }
          if (giftMapRef.current.size > 240) {
            const oldest = [...giftMapRef.current.entries()].sort((a, b) => a[1].lastTs - b[1].lastTs)[0];
            if (oldest) giftMapRef.current.delete(oldest[0]);
          }
          giftDirtyRef.current = true;
          pushToast(feed);
          break;
        }
        case 'superchat': {
          statsRef.current.scCount += 1;
          statsRef.current.scAmount += feed.price;
          statDirtyRef.current = true;
          break;
        }
        case 'guard': {
          statsRef.current.guardCount += feed.num;
          statDirtyRef.current = true;
          break;
        }
        case 'enter': {
          statsRef.current.enterCount += 1;
          statDirtyRef.current = true;
          break;
        }
        default:
          break;
      }

      scheduleFlush();
    },
    [bumpRate, pushToast, scheduleFlush, softReauth],
  );

  const appendSystem = useCallback(
    (text: string, tone: 'info' | 'live' | 'warn' = 'info') => {
      bufferRef.current.push(systemMessage(text, tone));
      lastEventRef.current = Date.now();
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const scheduleRetry = useCallback((reason: string, generation: number) => {
    if (!desiredRef.current || generation !== generationRef.current) return;

    attemptRef.current += 1;
    const currentAttempt = attemptRef.current;
    if (currentAttempt > MAX_ATTEMPTS) {
      desiredRef.current = false;
      setStatus('error');
      setAttempt(currentAttempt);
      setError(`${reason}（已尝试重连 ${MAX_ATTEMPTS} 次，仍然失败）`);
      return;
    }

    setStatus('reconnecting');
    setAttempt(currentAttempt);
    setError(reason);

    const delay = Math.min(15_000, 1200 * 2 ** (currentAttempt - 1));
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      if (!desiredRef.current || generation !== generationRef.current) return;
      const targetRoom = roomIdRef.current;
      if (targetRoom) connectRef.current?.(targetRoom, 'retry');
    }, delay);
  }, []);

  const startClient = useCallback(
    (bundle: RoomBundle, generation: number) => {
      const authUid = config.uid > 0 ? config.uid : bundle.danmaku.uid || 0;
      guestRef.current = authUid === 0;
      const credentials = {
        roomid: bundle.room.roomId,
        uid: authUid,
        protover: config.protover,
        buvid: config.buvid || bundle.danmaku.buvid || '',
        platform: 'web',
        clientver: '1.9.3',
        type: 2,
        key: config.token || bundle.danmaku.token || '',
      };

      setConnectionInfo({
        protocol: config.protover,
        hasToken: Boolean(credentials.key),
        hasBuvid: Boolean(credentials.buvid),
        uid: authUid,
        demo: false,
      });

      let client: Client;
      try {
        // 关闭库自带的重连（maxConnectTimes = 0），由这里统一管理重连与 token 刷新
        client = new Client(credentials, false, 0);
      } catch (err) {
        scheduleRetry(`创建弹幕连接失败：${errorText(err)}`, generation);
        return;
      }

      clientRef.current = client;

      let finished = false;
      const watchdog = window.setTimeout(() => {
        finish('连接超时，正在重新连接…');
      }, 12_000);

      function finish(reason: string) {
        if (finished) return;
        finished = true;
        window.clearTimeout(watchdog);
        try {
          client.close();
        } catch {
          // ignore
        }
        if (generation === generationRef.current) {
          appendSystem(reason, 'warn');
          scheduleRetry(reason, generation);
        }
      }

      client.on('open', () => {
        if (generation !== generationRef.current) return;
        window.clearTimeout(watchdog);
        attemptRef.current = 0;
        setAttempt(0);
        setStatus('live');
        setError(null);
        setStartedAt(Date.now());
        lastAuthRef.current = Date.now();
        maskedRef.current = { count: 0, since: 0 };
        appendSystem(`已连上弹幕服务器 · 房间 ${bundle.room.roomId}`, 'live');
      });

      client.on('message', (message) => {
        if (generation !== generationRef.current) return;
        if (message.op !== 5) return;
        const cmd = typeof message.cmd === 'string' ? message.cmd : '';
        if (!cmd) return;
        let payload: unknown;
        try {
          payload = JSON.parse(String(message.body));
        } catch {
          return;
        }
        applyParsed(cmd, payload);
      });

      client.on('error', (err) => {
        if (generation !== generationRef.current) return;
        setError(`连接异常：${errorText(err)}`);
      });

      client.on('close', () => {
        if (generation !== generationRef.current) return;
        setStatus((previous) => (previous === 'live' ? 'reconnecting' : previous));
        finish('连接已断开，正在重新连接…');
      });
    },
    [appendSystem, applyParsed, scheduleRetry],
  );

  const connectInternal = useCallback(
    (roomIdInput: number, mode: 'fresh' | 'retry') => {
      const roomId = Math.max(1, Math.floor(roomIdInput));
      if (!Number.isFinite(roomId)) return;

      const generation = generationRef.current + 1;
      generationRef.current = generation;
      desiredRef.current = true;
      roomIdRef.current = roomId;

      teardown();

      if (mode === 'fresh') {
        attemptRef.current = 0;
        setAttempt(0);
        bufferRef.current = [];
        statsRef.current = { ...emptyStats };
        giftMapRef.current.clear();
        statDirtyRef.current = false;
        giftDirtyRef.current = false;
        setMessages([]);
        setStats({ ...emptyStats });
        setGifts([]);
        setToasts([]);
        setLastEventAt(0);
        setStartedAt(null);
        setWarnings([]);
      }

      setError(null);
      setStatus(mode === 'fresh' ? 'connecting' : 'reconnecting');

      if (demoRef.current) {
        setRoom(DEMO_ROOM);
        setLiveStatus(1);
        setStatus('live');
        setStartedAt(Date.now());
        setConnectionInfo({ protocol: config.protover, hasToken: false, hasBuvid: false, uid: 0, demo: true });
        demoStopRef.current = startDemoStream({
          emit: (cmd, payload) => {
            if (generation !== generationRef.current) return;
            applyParsed(cmd, payload);
          },
        });
        return;
      }

      fetchRoomBundle(roomId, mode === 'retry')
        .then((bundle) => {
          if (generation !== generationRef.current) return;
          setRoom(bundle.room);
          setWarnings(bundle.warnings);
          setLiveStatus(bundle.room.liveStatus === 1 ? 1 : 0);
          startClient(bundle, generation);
        })
        .catch((err) => {
          if (generation !== generationRef.current) return;
          scheduleRetry(`获取直播间信息失败：${errorText(err)}`, generation);
        });
    },
    [applyParsed, scheduleRetry, startClient, teardown],
  );

  useEffect(() => {
    connectRef.current = connectInternal;
  }, [connectInternal]);

  const connect = useCallback((roomId: number) => {
    connectRef.current?.(roomId, 'fresh');
  }, []);

  const disconnect = useCallback(() => {
    desiredRef.current = false;
    generationRef.current += 1;
    teardown();
    setStatus('closed');
    setAttempt(0);
    setError(null);
  }, [teardown]);

  const clear = useCallback(() => {
    bufferRef.current = [];
    statsRef.current = { ...emptyStats };
    giftMapRef.current.clear();
    statDirtyRef.current = false;
    giftDirtyRef.current = false;
    setMessages([]);
    setStats({ ...emptyStats });
    setGifts([]);
    setLastEventAt(0);
  }, []);

  const reconnect = useCallback(() => {
    const target = roomIdRef.current;
    if (target) connectRef.current?.(target, 'fresh');
  }, []);

  // 访客会话定期刷新凭证；登录态不做任何自动重连
  useEffect(() => {
    if (status !== 'live' || config.authRefreshMinutes <= 0) return;

    const timer = window.setInterval(() => {
      if (!desiredRef.current || demoRef.current || !guestRef.current) return;
      if (Date.now() - lastAuthRef.current >= config.authRefreshMinutes * 60_000) {
        softReauth('访客凭证需要刷新');
      }
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [status, softReauth]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = rateRef.current;
      const nowSecond = Math.floor(Date.now() / 1000);
      while (state.second < nowSecond) {
        state.slots.push(0);
        if (state.slots.length > RATE_WINDOW) state.slots.shift();
        state.second += 1;
      }
      setRate(state.slots.slice());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      desiredRef.current = false;
      generationRef.current += 1;
      teardown();
    };
  }, [teardown]);

  return {
    status,
    room,
    messages,
    stats,
    gifts,
    rate,
    toasts,
    error,
    warnings,
    attempt,
    lastEventAt,
    startedAt,
    liveStatus,
    connectionInfo,
    connect,
    disconnect,
    reconnect,
    clear,
  };
}
