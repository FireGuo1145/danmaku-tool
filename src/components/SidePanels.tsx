import { useEffect, useState } from 'react';
import type { RoomMeta } from '../../shared/api';
import { formatCount, formatGold } from '../lib/format';
import type { ConnectionStatus, GiftRank, RoomStats } from '../types';
import type { ConnectionInfo } from '../lib/useLiveRoom';
import { IconCoins, IconEye, IconFlame, IconGift, IconHeart, IconStar, IconUsers } from './icons';

function RateChart({ data }: { data: readonly number[] }) {
  const max = Math.max(1, ...data);
  const step = 100 / Math.max(1, data.length);
  return (
    <svg className="rate-chart" viewBox="0 0 100 34" preserveAspectRatio="none" role="img" aria-label="消息速率">
      <defs>
        <linearGradient id="rateBar" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgba(251,114,153,0.25)" />
          <stop offset="100%" stopColor="rgba(251,114,153,0.95)" />
        </linearGradient>
      </defs>
      {data.map((value, index) => {
        const height = Math.max(value > 0 ? 2 : 0.6, (value / max) * 32);
        return (
          <rect
            key={index}
            x={index * step + 0.35}
            y={34 - height}
            width={Math.max(0.7, step - 0.7)}
            height={height}
            rx={0.7}
            fill={value > 0 ? 'url(#rateBar)' : 'rgba(255,255,255,0.08)'}
          />
        );
      })}
    </svg>
  );
}

export interface StatsPanelProps {
  stats: RoomStats;
  rate: number[];
  room: RoomMeta | null;
  liveStatus: number;
}

export function StatsPanel({ stats, rate, room, liveStatus }: StatsPanelProps) {
  const perSecond = rate.length > 0 ? rate[rate.length - 1] : 0;
  const recent = rate.slice(-10).reduce((sum, value) => sum + value, 0);

  return (
    <section className="card panel">
      <header className="panel-head">
        <h2>
          <IconStar size={16} />
          本场数据
        </h2>
        <span className={`live-state ${liveStatus === 1 ? 'is-live' : ''}`}>{liveStatus === 1 ? '直播中' : '未开播'}</span>
      </header>

      <div className="stat-grid">
        <article className="stat">
          <span className="stat-label">弹幕</span>
          <strong className="stat-value">{formatCount(stats.danmaku)}</strong>
          <span className="stat-foot">收到 {formatCount(stats.enterCount)} 次进场</span>
        </article>
        <article className="stat">
          <span className="stat-label">礼物</span>
          <strong className="stat-value">{formatGold(stats.giftGold)}</strong>
          <span className="stat-foot">{formatCount(stats.giftCount)} 个 · 免费 {formatCount(stats.giftSilver)}</span>
        </article>
        <article className="stat">
          <span className="stat-label">醒目留言</span>
          <strong className="stat-value">{stats.scCount}</strong>
          <span className="stat-foot">累计 ¥{formatCount(stats.scAmount)}</span>
        </article>
        <article className="stat">
          <span className="stat-label">大航海</span>
          <strong className="stat-value">{stats.guardCount}</strong>
          <span className="stat-foot">本场上舰次数</span>
        </article>
        <article className="stat">
          <span className="stat-label">人气</span>
          <strong className="stat-value">{formatCount(stats.popularity || room?.online || 0)}</strong>
          <span className="stat-foot">
            <IconFlame size={12} /> 实时人气值
          </span>
        </article>
        <article className="stat">
          <span className="stat-label">看过</span>
          <strong className="stat-value">{formatCount(stats.watched || room?.attention || 0)}</strong>
          <span className="stat-foot">
            <IconEye size={12} /> 累计观看
          </span>
        </article>
      </div>

      <div className="rate-block">
        <div className="rate-head">
          <span>消息速率</span>
          <span className="rate-now">
            <b>{perSecond}</b> 条/秒
            <em>近 10 秒 {recent} 条</em>
          </span>
        </div>
        <RateChart data={rate} />
      </div>

      <div className="stat-extra">
        <span>
          <IconHeart size={13} /> 点赞 {formatCount(stats.likes)}
        </span>
        <span>
          <IconUsers size={13} /> 高能用户 {formatCount(stats.onlineRank)}
        </span>
      </div>
    </section>
  );
}

export interface GiftRankPanelProps {
  ranks: GiftRank[];
}

export function GiftRankPanel({ ranks }: GiftRankPanelProps) {
  const top = ranks[0]?.gold ?? 1;

  return (
    <section className="card panel">
      <header className="panel-head">
        <h2>
          <IconGift size={16} />
          礼物榜
        </h2>
        <span className="panel-hint">按金瓜子价值</span>
      </header>

      {ranks.length === 0 ? (
        <p className="panel-empty">还没有人送礼，等待第一位金主～</p>
      ) : (
        <ol className="gift-rank">
          {ranks.slice(0, 6).map((rank, index) => (
            <li key={rank.uid || rank.name} className="gift-rank-item">
              <span className={`rank-no rank-${index + 1}`}>{index + 1}</span>
              <span className="rank-avatar">{rank.name.slice(0, 1)}</span>
              <div className="rank-main">
                <div className="rank-top">
                  <span className="rank-name" title={rank.name}>
                    {rank.name}
                  </span>
                  <span className="rank-gold">{formatGold(rank.gold)}</span>
                </div>
                <div className="rank-bar">
                  <i style={{ width: `${Math.max(4, (rank.gold / top) * 100)}%` }} />
                </div>
              </div>
              <span className="rank-count">×{formatCount(rank.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export interface ConnectionPanelProps {
  status: ConnectionStatus;
  room: RoomMeta | null;
  info: ConnectionInfo | null;
  startedAt: number | null;
  attempt: number;
  warnings: string[];
  demo: boolean;
}

export function ConnectionPanel({ status, room, info, startedAt, attempt, warnings, demo }: ConnectionPanelProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const uptime = startedAt && status === 'live' ? Math.max(0, now - startedAt) : 0;
  const minutes = Math.floor(uptime / 60_000);
  const seconds = Math.floor((uptime % 60_000) / 1000);

  return (
    <section className="card panel panel-connection">
      <header className="panel-head">
        <h2>
          <IconCoins size={16} />
          连接信息
        </h2>
        <span className={`conn-state is-${status}`}>{demo ? '本地回放' : 'WebSocket'}</span>
      </header>

      <dl className="conn-list">
        <div>
          <dt>房间</dt>
          <dd>{room ? `${room.roomId}${room.shortId ? `（短号 ${room.shortId}）` : ''}` : '—'}</dd>
        </div>
        <div>
          <dt>协议</dt>
          <dd>{info ? `protover ${info.protocol}${info.protocol === 2 ? ' · zlib' : ' · 明文'}` : '—'}</dd>
        </div>
        <div>
          <dt>鉴权</dt>
          <dd>
            {info?.demo
              ? '演示模式'
              : info
                ? `${info.hasToken ? 'token ✓' : 'token ✗'} · ${info.hasBuvid ? 'buvid ✓' : 'buvid ✗'}`
                : '—'}
          </dd>
        </div>
        <div>
          <dt>身份</dt>
          <dd>
            {info?.demo
              ? '演示模式'
              : info && info.uid > 0
                ? `登录态 · uid ${info.uid}`
                : '访客（uid 0）'}
          </dd>
        </div>
        <div>
          <dt>连接时长</dt>
          <dd>{status === 'live' ? `${minutes} 分 ${String(seconds).padStart(2, '0')} 秒` : '—'}</dd>
        </div>
        <div>
          <dt>重连次数</dt>
          <dd>{attempt}</dd>
        </div>
      </dl>

      {info && !info.demo && info.uid === 0 ? (
        <p className="conn-hint">
          访客模式：部分昵称会被 B 站打码（如 <code>取***</code>）。在 <code>.env</code> 配置
          <code>BILI_COOKIE</code> 可用登录态连接。
        </p>
      ) : null}

      {warnings.length > 0 ? (
        <details className="conn-warnings">
          <summary>接口提示（{warnings.length}）</summary>
          <ul>
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
