import type { RoomMeta } from '../../shared/api';
import { formatCount } from '../lib/format';
import type { ConnectionStatus, RoomStats } from '../types';
import { IconExternal, IconEye, IconFlame, IconUsers } from './icons';

export interface RoomCardProps {
  room: RoomMeta | null;
  stats: RoomStats;
  liveStatus: number;
  status: ConnectionStatus;
  demo: boolean;
}

export function RoomCard({ room, stats, liveStatus, status, demo }: RoomCardProps) {
  if (!room) {
    return (
      <section className="card room-card room-card--empty">
        <div className="room-cover skeleton" />
        <div className="room-body">
          <div className="skeleton skeleton-line" style={{ width: '42%', height: 18 }} />
          <div className="skeleton skeleton-line" style={{ width: '26%' }} />
          <p className="room-hint">
            {status === 'connecting' || status === 'reconnecting'
              ? '正在获取直播间信息…'
              : '输入 B 站直播间号，连接后即可实时接收弹幕与礼物。'}
          </p>
        </div>
      </section>
    );
  }

  const cover = room.cover || room.keyframe;
  const isLive = liveStatus === 1;
  const popularity = stats.popularity || room.online;
  const watched = stats.watched || room.attention;

  return (
    <section className="card room-card">
      <div className={`room-cover ${cover ? '' : 'room-cover--placeholder'}`}>
        {cover ? (
          <img
            src={cover}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
        <span className={`live-badge ${isLive ? 'is-live' : ''}`}>
          <i />
          {isLive ? '直播中' : '未开播'}
        </span>
      </div>

      <div className="room-body">
        <div className="room-heading">
          <h1 className="room-title" title={room.title}>
            {room.title}
          </h1>
          <a
            className="room-link"
            href={`https://live.bilibili.com/${room.roomId}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            去直播间
            <IconExternal size={13} />
          </a>
        </div>

        <div className="room-meta">
          <span className="room-up">
            {room.upFace ? (
              <img src={room.upFace} alt="" referrerPolicy="no-referrer" loading="lazy" />
            ) : (
              <span className="avatar-fallback">{room.upName.slice(0, 1)}</span>
            )}
            {room.upName}
          </span>
          {room.parentAreaName ? (
            <span className="room-area">
              {room.parentAreaName}
              {room.areaName ? ` · ${room.areaName}` : ''}
            </span>
          ) : null}
          <span className="room-id">房间号 {room.roomId}</span>
          {demo ? <span className="chip chip-demo">演示数据</span> : null}
        </div>

        <div className="room-chips">
          <span className="metric">
            <IconFlame size={14} />
            <b>{formatCount(popularity)}</b>
            <em>人气</em>
          </span>
          <span className="metric">
            <IconEye size={14} />
            <b>{formatCount(watched)}</b>
            <em>看过</em>
          </span>
          <span className="metric">
            <IconUsers size={14} />
            <b>{formatCount(stats.fans || room.attention)}</b>
            <em>粉丝</em>
          </span>
        </div>
      </div>
    </section>
  );
}
