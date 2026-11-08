import { useEffect, useState, type FormEvent } from 'react';
import { config } from '../config';
import type { ConnectionStatus } from '../types';
import { IconChat, IconPower, IconSettings, IconSparkle } from './icons';

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  idle: '未连接',
  connecting: '连接中',
  live: '已连接',
  reconnecting: '重连中',
  closed: '已断开',
  error: '连接失败',
};

export interface TopBarProps {
  status: ConnectionStatus;
  attempt: number;
  roomId: number | null;
  demo: boolean;
  onConnect: (roomId: number) => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
}

export function TopBar({ status, attempt, roomId, demo, onConnect, onDisconnect, onOpenSettings }: TopBarProps) {
  const [draft, setDraft] = useState(roomId ? String(roomId) : '');

  useEffect(() => {
    if (roomId) setDraft(String(roomId));
  }, [roomId]);

  const busy = status === 'live' || status === 'connecting' || status === 'reconnecting';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number.parseInt(draft.trim(), 10);
    if (!Number.isInteger(value) || value <= 0) return;
    onConnect(value);
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-logo">
          <IconChat size={20} />
        </span>
        <span className="brand-text">
          <strong>{config.title}</strong>
          <em>Bilibili Live · Danmaku</em>
        </span>
      </div>

      <div className={`status-pill is-${status}`}>
        <i className="status-dot" />
        <span>{STATUS_TEXT[status]}</span>
        {status === 'reconnecting' && attempt > 0 ? <span className="status-extra">第 {attempt} 次</span> : null}
        {demo ? (
          <span className="status-extra">
            <IconSparkle size={12} /> 演示
          </span>
        ) : null}
      </div>

      <form className="room-form" onSubmit={handleSubmit}>
        <label className="room-input">
          <span className="room-input-prefix">#</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="输入房间号 / 短号"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            aria-label="直播间房间号"
          />
        </label>
        {busy ? (
          <button type="button" className="btn btn-ghost" onClick={onDisconnect}>
            <IconPower size={15} />
            断开
          </button>
        ) : (
          <button type="submit" className="btn btn-primary">
            <IconPower size={15} />
            连接
          </button>
        )}
        <button type="button" className="icon-btn" title="设置" aria-label="打开设置" onClick={onOpenSettings}>
          <IconSettings size={18} />
        </button>
      </form>
    </header>
  );
}
