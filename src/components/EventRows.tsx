import { memo, useState } from 'react';
import {
  formatCount,
  formatGold,
  formatTime,
  guardLabel,
  initials,
  readableDanmakuColor,
  withAlpha,
} from '../lib/format';
import type {
  DanmakuEvent,
  EnterEvent,
  FeedEvent,
  GiftEvent,
  GuardEvent,
  GuardLevel,
  LikeEvent,
  LiveUser,
  Medal,
  SuperChatEvent,
  SystemEvent,
} from '../types';
import { IconChat, IconCrown, IconGift, IconHeart } from './icons';

const AVATAR_COLORS = ['#fb7299', '#00aeec', '#ffb45c', '#9d7bff', '#3ddc97', '#ff7a64', '#5ec8f5', '#f06292'];

function colorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function Avatar({ user, size = 26 }: { user: LiveUser; size?: number }) {
  const [failed, setFailed] = useState(false);
  const face = user.face;

  if (face && !failed) {
    return (
      <img
        className="avatar"
        src={face}
        width={size}
        height={size}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="avatar avatar-fallback"
      style={{ width: size, height: size, background: colorFromName(user.name), fontSize: size * 0.46 }}
      aria-hidden="true"
    >
      {initials(user.name)}
    </span>
  );
}

export function MedalPill({ medal }: { medal: Medal }) {
  return (
    <span
      className="medal"
      title={`${medal.name} · 等级 ${medal.level}`}
      style={{
        color: medal.color,
        borderColor: withAlpha(medal.color, 0.42),
        background: withAlpha(medal.color, 0.12),
      }}
    >
      {medal.name}
      <b>{medal.level}</b>
    </span>
  );
}

export function GuardChip({ level }: { level: GuardLevel }) {
  if (!level) return null;
  return <span className={`guard guard-${level}`}>{guardLabel(level)}</span>;
}

function DanmakuRow({ event }: { event: DanmakuEvent }) {
  const { user } = event;
  return (
    <div className={`feed-row row-danmaku ${event.mode === 5 ? 'is-pinned' : ''}`}>
      <Avatar user={user} />
      <div className="row-main">
        <div className="row-head">
          {user.medal ? <MedalPill medal={user.medal} /> : null}
          <GuardChip level={user.guardLevel} />
          {user.isAdmin ? <span className="tag tag-admin">房管</span> : null}
          <span className="row-name">{user.name}</span>
          {event.mode === 5 ? <span className="tag tag-pin">置顶</span> : null}
        </div>
        <div className="row-text" style={{ color: readableDanmakuColor(event.color) }}>
          {event.emoticon ? (
            <img
              className="emoticon"
              src={event.emoticon}
              alt={event.text}
              title={event.text}
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          ) : (
            event.text
          )}
        </div>
      </div>
      <time className="row-time" title={new Date(event.ts).toLocaleString('zh-CN')}>
        {formatTime(event.ts)}
      </time>
    </div>
  );
}

function GiftRow({ event }: { event: GiftEvent }) {
  const total = event.price * event.num;
  return (
    <div className={`feed-row row-gift ${event.coinType === 'gold' ? 'is-gold' : ''}`}>
      <span className="gift-icon">
        {event.icon ? (
          <img src={event.icon} alt="" referrerPolicy="no-referrer" loading="lazy" />
        ) : (
          <IconGift size={18} />
        )}
      </span>
      <div className="row-main">
        <div className="row-head">
          {event.user.medal ? <MedalPill medal={event.user.medal} /> : null}
          <GuardChip level={event.user.guardLevel} />
          <span className="row-name">{event.user.name}</span>
          <span className="muted">{event.action}</span>
          <span className="gift-name">{event.giftName}</span>
          <span className="gift-count">×{event.num}</span>
        </div>
        <div className="row-sub">
          <span className={`coin ${event.coinType}`}>
            {event.coinType === 'gold' ? formatGold(total) : `${formatCount(total)} 银瓜子`}
          </span>
          {event.comboNum && event.comboNum > event.num ? (
            <span className="combo-tag">连击 {event.comboNum}</span>
          ) : null}
        </div>
      </div>
      <time className="row-time" title={new Date(event.ts).toLocaleString('zh-CN')}>
        {formatTime(event.ts)}
      </time>
    </div>
  );
}

function SuperChatRow({ event }: { event: SuperChatEvent }) {
  const accent = event.color ?? '#f6a623';
  return (
    <div
      className="feed-row row-sc"
      style={{
        borderColor: withAlpha(accent, 0.55),
        background: `linear-gradient(100deg, ${withAlpha(accent, 0.16)}, transparent 65%)`,
      }}
    >
      <div className="sc-head">
        <Avatar user={event.user} size={22} />
        {event.user.medal ? <MedalPill medal={event.user.medal} /> : null}
        <span className="row-name">{event.user.name}</span>
        <span className="sc-badge">醒目留言</span>
        <span className="sc-price">¥{event.price}</span>
      </div>
      <p className="sc-text">{event.text}</p>
    </div>
  );
}

function GuardRow({ event }: { event: GuardEvent }) {
  return (
    <div className="feed-row row-guard">
      <span className={`guard-icon guard-${event.level}`}>
        <IconCrown size={16} />
      </span>
      <div className="row-main">
        <div className="row-head">
          {event.user.medal ? <MedalPill medal={event.user.medal} /> : null}
          <span className="row-name">{event.user.name}</span>
          <span className="muted">开通了</span>
          <span className={`guard-name guard-${event.level}`}>{event.guardName}</span>
          {event.num > 1 ? <span className="gift-count">×{event.num}</span> : null}
        </div>
        <div className="row-sub">
          <span className="coin gold">{formatGold(event.price * event.num)}</span>
          <span className="muted">感谢上舰！</span>
        </div>
      </div>
    </div>
  );
}

function EnterRow({ event }: { event: EnterEvent }) {
  const isFollow = event.msgType !== 1;
  return (
    <div className={`feed-row row-enter ${isFollow ? 'is-follow' : ''}`}>
      <IconChat size={13} />
      <span className="row-name">{event.user.name}</span>
      <span className="muted">{event.label ?? `进入了直播间`}</span>
      {event.user.medal ? <MedalPill medal={event.user.medal} /> : null}
    </div>
  );
}

function LikeRow({ event }: { event: LikeEvent }) {
  return (
    <div className="feed-row row-like">
      <IconHeart size={13} />
      <span className="row-name">{event.user.name}</span>
      <span className="muted">{event.text}</span>
    </div>
  );
}

function SystemRow({ event }: { event: SystemEvent }) {
  return (
    <div className={`row-system tone-${event.tone}`}>
      <span>{event.text}</span>
    </div>
  );
}

export const EventRow = memo(function EventRow({ event }: { event: FeedEvent }) {
  switch (event.kind) {
    case 'danmaku':
      return <DanmakuRow event={event} />;
    case 'gift':
      return <GiftRow event={event} />;
    case 'superchat':
      return <SuperChatRow event={event} />;
    case 'guard':
      return <GuardRow event={event} />;
    case 'enter':
      return <EnterRow event={event} />;
    case 'like':
      return <LikeRow event={event} />;
    case 'system':
      return <SystemRow event={event} />;
    default:
      return null;
  }
});
