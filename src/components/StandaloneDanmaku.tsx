import { useEffect, useMemo, useRef, useState } from 'react';
import { config } from '../config';
import { formatCount, formatGold } from '../lib/format';
import { readOverlayConfig } from '../lib/overlayConfig';
import { OVERLAY_LINKS } from '../lib/router';
import { useLiveRoom } from '../lib/useLiveRoom';
import type { ConnectionStatus, FeedFilter } from '../types';
import { Feed } from './Feed';

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  idle: '未连接',
  connecting: '连接中',
  live: '已连接',
  reconnecting: '重连中',
  closed: '已断开',
  error: '连接失败',
};

/**
 * 独立的弹幕台：和主界面的弹幕流完全一致（同款样式、全部消息类型），
 * 只是去掉了房间卡片和侧栏，方便单独开一个页面 / 放进 OBS。
 */
export function StandaloneDanmaku() {
  const cfg = useMemo(() => readOverlayConfig('danmaku'), []);
  const live = useLiveRoom({ maxMessages: cfg.maxMessages, demo: cfg.demo });
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const startedRef = useRef(false);
  const transparent = cfg.theme === 'transparent';

  useEffect(() => {
    const root = document.documentElement;
    if (transparent) root.classList.add('is-overlay');
    return () => root.classList.remove('is-overlay');
  }, [transparent]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    live.connect(cfg.roomId);
    return () => {
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 默认展示全部消息；?guard=0 / ?sc=0 可单独隐藏对应类型
  const messages = useMemo(
    () =>
      live.messages.filter((event) => {
        if (event.kind === 'guard') return cfg.showGuard;
        if (event.kind === 'superchat') return cfg.showSuperChat;
        return true;
      }),
    [live.messages, cfg.showGuard, cfg.showSuperChat],
  );

  const isLive = live.liveStatus === 1;
  const title = live.room?.title ?? `房间 ${cfg.roomId}`;
  const suffix = cfg.demo ? '&demo=1' : '';

  return (
    <div className={`app standalone ${transparent ? 'standalone--transparent' : ''}`}>
      {transparent ? null : (
        <div className="backdrop" aria-hidden="true">
          <span className="orb orb-pink" />
          <span className="orb orb-blue" />
          <span className="grid" />
        </div>
      )}

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
          <span className={`ov-status is-${live.status}`}>{STATUS_TEXT[live.status]}</span>
          <nav className="ov-nav">
            {OVERLAY_LINKS.map((link) => (
              <a
                key={link.path}
                href={`${link.path}?room=${cfg.roomId}${suffix}`}
                className={link.mode === 'danmaku' ? 'is-active' : ''}
              >
                {link.label}
              </a>
            ))}
            <a href={`/?room=${cfg.roomId}${suffix}`} className="ov-full">
              完整界面 ↗
            </a>
          </nav>
        </header>
      ) : null}

      <Feed
        messages={messages}
        filter={filter}
        onFilterChange={setFilter}
        showEnter={cfg.showEnter}
        showLike={cfg.showLike}
        fontSize={cfg.fontSize}
        autoScroll={autoScroll}
        onToggleAutoScroll={() => setAutoScroll((previous) => !previous)}
        onClear={live.clear}
        status={live.status}
        error={live.error}
        attempt={live.attempt}
        onRetry={live.reconnect}
        demo={cfg.demo}
        quickRooms={config.quickRooms}
        onQuickRoom={(roomId) => live.connect(roomId)}
        pinned={!cfg.scrollable}
      />
    </div>
  );
}
