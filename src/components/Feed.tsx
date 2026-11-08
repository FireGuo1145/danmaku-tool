import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatCount } from '../lib/format';
import type { ConnectionStatus, FeedEvent, FeedFilter } from '../types';
import { EventRow } from './EventRows';
import { IconArrowDown, IconChat, IconRefresh, IconTrash } from './icons';

const FILTERS: Array<{ key: FeedFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'danmaku', label: '弹幕' },
  { key: 'gift', label: '礼物' },
  { key: 'superchat', label: '醒目留言' },
  { key: 'guard', label: '大航海' },
  { key: 'enter', label: '进场' },
];

const KIND_FILTER: Partial<Record<FeedEvent['kind'], FeedFilter>> = {
  danmaku: 'danmaku',
  gift: 'gift',
  superchat: 'superchat',
  guard: 'guard',
  enter: 'enter',
};

export interface FeedProps {
  messages: FeedEvent[];
  filter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  showEnter: boolean;
  showLike: boolean;
  fontSize: number;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  onClear: () => void;
  status: ConnectionStatus;
  error: string | null;
  attempt: number;
  onRetry: () => void;
  demo: boolean;
  quickRooms: readonly number[];
  onQuickRoom: (roomId: number) => void;
}

export function Feed({
  messages,
  filter,
  onFilterChange,
  showEnter,
  showLike,
  fontSize,
  autoScroll,
  onToggleAutoScroll,
  onClear,
  status,
  error,
  attempt,
  onRetry,
  demo,
  quickRooms,
  onQuickRoom,
}: FeedProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [hasNew, setHasNew] = useState(false);
  const lastSeenRef = useRef<string | null>(null);

  const visible = useMemo(
    () =>
      messages.filter((event) => {
        if (event.kind === 'enter' && !showEnter) return false;
        if (event.kind === 'like' && !showLike) return false;
        if (filter === 'all') return true;
        return KIND_FILTER[event.kind] === filter;
      }),
    [messages, filter, showEnter, showLike],
  );

  const counts = useMemo(() => {
    const result: Record<FeedFilter, number> = { all: 0, danmaku: 0, gift: 0, superchat: 0, guard: 0, enter: 0 };
    for (const event of messages) {
      if (event.kind === 'like') continue;
      if (event.kind === 'enter' && !showEnter) continue;
      const key = KIND_FILTER[event.kind];
      if (key) result[key] += 1;
      result.all += 1;
    }
    return result;
  }, [messages, showEnter]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stickRef.current = true;
    setHasNew(false);
  };

  // 新消息到达后：贴在底部时跟随滚动，用户回看历史时只提示「有新消息」
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const lastId = visible[visible.length - 1]?.id ?? null;
    if (!lastId || lastId === lastSeenRef.current) return;
    const isFirst = lastSeenRef.current === null;
    lastSeenRef.current = lastId;
    if (autoScroll && (isFirst || stickRef.current)) {
      el.scrollTop = el.scrollHeight;
      stickRef.current = true;
      setHasNew(false);
    } else if (!isFirst) {
      setHasNew(true);
    }
  }, [visible, autoScroll]);

  useEffect(() => {
    // 切换筛选时回到最底部
    lastSeenRef.current = null;
    stickRef.current = true;
    setHasNew(false);
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filter]);

  useEffect(() => {
    if (autoScroll) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScroll]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 72;
    stickRef.current = atBottom;
    if (atBottom) setHasNew(false);
  };

  const showBanner = status === 'error' || (status === 'reconnecting' && Boolean(error));

  let placeholder: ReactNode = null;
  if (visible.length === 0) {
    if (status === 'connecting' || status === 'reconnecting') {
      placeholder = (
        <div className="feed-placeholder">
          <span className="spinner" />
          <p>正在连接直播间，马上就有弹幕飞过来…</p>
        </div>
      );
    } else if (status === 'idle' || status === 'closed' || status === 'error') {
      placeholder = (
        <div className="feed-placeholder">
          <span className="placeholder-icon">
            <IconChat size={26} />
          </span>
          <p className="placeholder-title">{status === 'closed' ? '连接已断开' : '还没有开始接收弹幕'}</p>
          <p className="placeholder-desc">输入房间号后点击「连接」，或直接试试这些正在直播的房间：</p>
          <div className="quick-rooms">
            {quickRooms.map((room) => (
              <button key={room} type="button" className="chip chip-room" onClick={() => onQuickRoom(room)}>
                {room}
              </button>
            ))}
          </div>
        </div>
      );
    } else if (status === 'live') {
      placeholder = (
        <div className="feed-placeholder">
          <span className="placeholder-icon">
            <IconChat size={26} />
          </span>
          <p className="placeholder-title">已连接，等待第一条消息…</p>
          <p className="placeholder-desc">这个直播间暂时比较安静，可以换个热闹的房间看看：</p>
          <div className="quick-rooms">
            {quickRooms.map((room) => (
              <button key={room} type="button" className="chip chip-room" onClick={() => onQuickRoom(room)}>
                {room}
              </button>
            ))}
          </div>
        </div>
      );
    } else {
      placeholder = (
        <div className="feed-placeholder">
          <span className="placeholder-icon">
            <IconChat size={26} />
          </span>
          <p className="placeholder-title">当前筛选下还没有消息</p>
          <p className="placeholder-desc">换个筛选条件，或等待下一条互动。</p>
        </div>
      );
    }
  }

  return (
    <section className="card feed-card">
      <div className="feed-toolbar">
        <div className="feed-filters">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`chip ${filter === item.key ? 'is-active' : ''}`}
              onClick={() => onFilterChange(item.key)}
            >
              {item.label}
              {item.key !== 'all' && counts[item.key] > 0 ? <em>{formatCount(counts[item.key])}</em> : null}
            </button>
          ))}
        </div>
        <div className="feed-actions">
          <button
            type="button"
            className={`toggle ${autoScroll ? 'is-on' : ''}`}
            onClick={onToggleAutoScroll}
            title="自动滚动到最新消息"
          >
            <i />
            自动滚动
          </button>
          <button type="button" className="icon-btn" onClick={onClear} title="清空消息" aria-label="清空消息">
            <IconTrash size={16} />
          </button>
        </div>
      </div>

      {showBanner ? (
        <div className="banner banner-warn">
          <span>
            {error ?? '连接不稳定'}
            {status === 'reconnecting' && attempt > 0 ? `（第 ${attempt} 次重连）` : ''}
          </span>
          <button type="button" className="banner-action" onClick={onRetry}>
            <IconRefresh size={13} />
            立即重连
          </button>
        </div>
      ) : null}

      <div className="feed-list" ref={listRef} onScroll={handleScroll} style={{ fontSize }}>
        {visible.length === 0 ? placeholder : null}
        {visible.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>

      <button
        type="button"
        className={`jump-latest ${hasNew ? 'is-visible' : ''}`}
        onClick={scrollToBottom}
        tabIndex={hasNew ? 0 : -1}
      >
        <IconArrowDown size={14} />
        有新消息
      </button>

      {demo ? <div className="feed-footnote">演示模式 · 消息由本地回放生成，未连接 B 站</div> : null}
    </section>
  );
}
