import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RoomMeta } from '../../shared/api';
import { formatCount, formatGold, formatRelative } from '../lib/format';
import { readOverlayConfig, type OverlayConfig } from '../lib/overlayConfig';
import { OVERLAY_LINKS, type OverlayMode } from '../lib/router';
import { useLiveRoom } from '../lib/useLiveRoom';
import type { ConnectionStatus, FeedEvent, GiftRank, LiveUser, RoomStats } from '../types';
import { Avatar, EventRow } from './EventRows';
import { IconFlame, IconGift, IconStar } from './icons';

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  idle: '未连接',
  connecting: '连接中',
  live: '已连接',
  reconnecting: '重连中',
  closed: '已断开',
  error: '连接失败',
};

function emptyText(status: ConnectionStatus, mode: OverlayMode): string {
  if (status === 'connecting') return '正在连接直播间…';
  if (status === 'reconnecting') return '连接中断，正在重连…';
  if (status === 'error') return '连接失败，请检查房间号或网络';
  if (status === 'closed' || status === 'idle') return '等待连接…';
  if (mode === 'stats') return '等待数据…';
  if (mode === 'superchat') return '暂无醒目留言';
  if (mode === 'gift') return '等待礼物…';
  return '等待弹幕…';
}

function filterEvents(events: FeedEvent[], cfg: OverlayConfig): FeedEvent[] {
  switch (cfg.mode) {
    case 'gift':
      return events.filter(
        (event) =>
          event.kind === 'gift' ||
          (event.kind === 'guard' && cfg.showGuard) ||
          (event.kind === 'superchat' && cfg.showSuperChat),
      );
    case 'superchat':
      return events.filter((event) => event.kind === 'superchat');
    case 'stats':
      return [];
    default:
      return events.filter((event) => {
        switch (event.kind) {
          case 'danmaku':
            return true;
          case 'gift':
            return true;
          case 'guard':
            return cfg.showGuard;
          case 'superchat':
            return cfg.showSuperChat;
          case 'enter':
            return cfg.showEnter;
          case 'like':
            return cfg.showLike;
          default:
            return false;
        }
      });
  }
}

function rankUser(rank: GiftRank): LiveUser {
  return { uid: rank.uid, name: rank.name, face: rank.face, guardLevel: 0 };
}

interface StatsViewProps {
  stats: RoomStats;
  rate: number[];
  room: RoomMeta | null;
  liveStatus: number;
  gifts: GiftRank[];
}

function OverlayStats({ stats, rate, room, liveStatus, gifts }: StatsViewProps) {
  const max = Math.max(1, ...rate);
  const tiles = [
    { label: '弹幕', value: formatCount(stats.danmaku), sub: `${formatCount(stats.enterCount)} 次进场`, tone: 'pink' },
    { label: '礼物', value: formatGold(stats.giftGold), sub: `${formatCount(stats.giftCount)} 个`, tone: 'gold' },
    { label: '醒目留言', value: formatCount(stats.scCount), sub: `¥${formatCount(stats.scAmount)}`, tone: 'pink' },
    { label: '大航海', value: formatCount(stats.guardCount), sub: '上舰次数', tone: 'blue' },
    { label: '人气', value: formatCount(stats.popularity || room?.online || 0), sub: '实时人气', tone: 'pink' },
    { label: '看过', value: formatCount(stats.watched || room?.attention || 0), sub: '累计观看', tone: 'blue' },
  ];

  return (
    <div className="ov-stats">
      <div className="ov-stats-head">
        <span className={`ov-live ${liveStatus === 1 ? 'is-live' : ''}`}>
          <i />
          {liveStatus === 1 ? '直播中' : '未开播'}
        </span>
        <strong>{room?.title ?? '直播间数据'}</strong>
        <span className="ov-stats-meta">{room?.upName}</span>
      </div>

      <div className="ov-tiles">
        {tiles.map((tile) => (
          <article key={tile.label} className={`ov-stat tone-${tile.tone}`}>
            <span className="ov-stat-label">{tile.label}</span>
            <strong className="ov-stat-value">{tile.value}</strong>
            <span className="ov-stat-sub">{tile.sub}</span>
          </article>
        ))}
      </div>

      <div className="ov-rate-block">
        <div className="ov-rate-head">
          <span>消息速率</span>
          <span>
            <b>{rate[rate.length - 1] ?? 0}</b> 条/秒
          </span>
        </div>
        <div className="ov-rate">
          {rate.map((value, index) => (
            <i key={index} style={{ height: `${Math.max(4, (value / max) * 100)}%` }} />
          ))}
        </div>
      </div>

      <div className="ov-top-gifts">
        {gifts.slice(0, 3).map((rank, index) => (
          <span key={rank.uid || rank.name} className="ov-top-gift">
            <em>#{index + 1}</em>
            {rank.name}
            <b>{formatGold(rank.gold)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function OverlayView({ mode }: { mode: OverlayMode }) {
  const cfg = useMemo(() => readOverlayConfig(mode), [mode]);
  const live = useLiveRoom({ maxMessages: cfg.maxMessages, demo: cfg.demo });
  const startedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [hasNew, setHasNew] = useState(false);

  // 透明背景：方便 OBS 直接叠加
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('is-overlay');
    root.dataset.overlayTheme = cfg.theme;
    return () => {
      root.classList.remove('is-overlay');
      delete root.dataset.overlayTheme;
    };
  }, [cfg.theme]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    live.connect(cfg.roomId);
    return () => {
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const events = useMemo(() => filterEvents(live.messages, cfg), [live.messages, cfg]);

  // 默认始终锚定最新消息；只有显式传入 ?scroll=1 才允许滚动并暂停跟随
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (!cfg.scrollable || stickRef.current) {
      el.scrollTop = el.scrollHeight;
      setHasNew(false);
    } else if (events.length > 0) {
      setHasNew(true);
    }
  }, [events, cfg.scrollable]);

  const handleListScroll = () => {
    if (!cfg.scrollable) return;
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    stickRef.current = atBottom;
    if (atBottom) setHasNew(false);
  };

  const jumpToLatest = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickRef.current = true;
    setHasNew(false);
  };

  const listClass = `ov-list ${cfg.scrollable ? 'is-scrollable' : 'is-pinned'}`;
  const jumpButton =
    cfg.scrollable && hasNew ? (
      <button type="button" className="ov-jump" onClick={jumpToLatest}>
        ↓ 回到最新
      </button>
    ) : null;

  const isLive = live.liveStatus === 1;
  const title = live.room?.title ?? `房间 ${cfg.roomId}`;
  const query = `?room=${cfg.roomId}${cfg.demo ? '&demo=1' : ''}`;

  const list =
    events.length === 0 ? (
      <div className="ov-empty">
        <span className="spinner" />
        <p>{emptyText(live.status, mode)}</p>
      </div>
    ) : (
      <div className="ov-list-inner">{events.map((event) => <EventRow key={event.id} event={event} />)}</div>
    );

  return (
    <div className={`overlay overlay--${cfg.theme} overlay--${mode}`}>
      {cfg.chrome ? (
        <header className="ov-head">
          <span className={`ov-live ${isLive ? 'is-live' : ''}`}>
            <i />
            {isLive ? '直播中' : '未开播'}
          </span>
          <strong className="ov-title" title={title}>
            {title}
          </strong>
          {live.room?.upName ? <span className="ov-up">{live.room.upName}</span> : null}
          <span className="ov-count">
            {formatCount(live.stats.danmaku)} 条弹幕 · 礼物 {formatGold(live.stats.giftGold)}
          </span>
          <span className={`ov-status is-${live.status}`}>
            {STATUS_TEXT[live.status]}
            {live.status === 'reconnecting' && live.attempt > 0 ? ` · ${live.attempt}` : ''}
          </span>
          <nav className="ov-nav">
            {OVERLAY_LINKS.map((link) => (
              <a key={link.path} href={`${link.path}${query}`} className={link.mode === mode ? 'is-active' : ''}>
                {link.label}
              </a>
            ))}
            <a href={`/${query}`} className="ov-full">
              完整界面 ↗
            </a>
          </nav>
        </header>
      ) : null}

      {mode === 'stats' ? (
        <OverlayStats
          stats={live.stats}
          rate={live.rate}
          room={live.room}
          liveStatus={live.liveStatus}
          gifts={live.gifts}
        />
      ) : mode === 'gift' ? (
        <div className="ov-grid">
          <section className="ov-panel">
            <header className="ov-panel-head">
              <IconGift size={14} />
              礼物动态
            </header>
            <div
              className={listClass}
              ref={listRef}
              style={{ fontSize: cfg.fontSize }}
              onScroll={handleListScroll}
            >
              {list}
            </div>
            {jumpButton}
          </section>
          <section className="ov-panel ov-rank">
            <header className="ov-panel-head">
              <IconStar size={14} />
              礼物榜
            </header>
            {live.gifts.length === 0 ? (
              <p className="ov-rank-empty">暂无礼物</p>
            ) : (
              <ol className="ov-rank-list">
                {live.gifts.slice(0, 5).map((rank, index) => (
                  <li key={rank.uid || rank.name}>
                    <em className={`ov-rank-no no-${index + 1}`}>{index + 1}</em>
                    <Avatar user={rankUser(rank)} size={20} />
                    <span className="ov-rank-name" title={rank.name}>
                      {rank.name}
                    </span>
                    <b>{formatGold(rank.gold)}</b>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      ) : (
        <section className="ov-panel ov-panel--main">
          <div
            className={listClass}
            ref={listRef}
            style={{ fontSize: cfg.fontSize }}
            onScroll={handleListScroll}
          >
            {list}
          </div>
          {jumpButton}
        </section>
      )}

      {live.error && live.status !== 'live' ? (
        <div className="ov-error">
          <IconFlame size={13} />
          {live.error}
          {live.lastEventAt > 0 ? ` · 最近消息 ${formatRelative(live.lastEventAt)}` : ''}
        </div>
      ) : null}

      {cfg.chrome ? (
        <p className="ov-hint">
          OBS：添加「浏览器」来源并填入当前地址即可；<code>?theme=dark</code> 切换深色底，
          <code>?chrome=0</code> 隐藏此栏，<code>&amp;scroll=1</code> 允许手动滚动历史（默认锁定最新），
          <code>&amp;demo=1</code> 预览演示数据。
        </p>
      ) : null}
    </div>
  );
}
