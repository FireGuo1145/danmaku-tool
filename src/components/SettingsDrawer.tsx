import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import type { ConnectionStatus } from '../types';
import type { Settings } from '../lib/settings';
import { IconClose, IconPower, IconRefresh, IconSettings } from './icons';

interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  desc?: string;
}

function Switch({ checked, onChange, label, desc }: SwitchProps) {
  return (
    <label className="field-row">
      <span className="field-text">
        <b>{label}</b>
        {desc ? <em>{desc}</em> : null}
      </span>
      <span className={`switch ${checked ? 'is-on' : ''}`}>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <i />
      </span>
    </label>
  );
}

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function RangeField({ label, value, min, max, step = 1, suffix, onChange }: RangeFieldProps) {
  return (
    <label className="field">
      <span className="field-label">
        <b>{label}</b>
        <span>
          {value}
          {suffix ?? ''}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export interface SettingsDrawerProps {
  open: boolean;
  settings: Settings;
  status: ConnectionStatus;
  onChange: (patch: Partial<Settings>) => void;
  onApplyRoom: (roomId: number) => void;
  onReset: () => void;
  onClose: () => void;
  footer: ReactNode;
}

export function SettingsDrawer({
  open,
  settings,
  status,
  onChange,
  onApplyRoom,
  onReset,
  onClose,
  footer,
}: SettingsDrawerProps) {
  const [roomDraft, setRoomDraft] = useState(String(settings.roomId));

  useEffect(() => {
    setRoomDraft(String(settings.roomId));
  }, [settings.roomId]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const applyRoom = () => {
    const value = Number.parseInt(roomDraft.trim(), 10);
    if (!Number.isInteger(value) || value <= 0) return;
    onApplyRoom(value);
    onClose();
  };

  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(value)) return;
    onChange({ giftToastMin: Math.max(0, value) });
  };

  return (
    <>
      <div className={`drawer-overlay ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`drawer ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label="设置">
        <header className="drawer-head">
          <h2>
            <IconSettings size={17} />
            设置
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭设置">
            <IconClose size={16} />
          </button>
        </header>

        <div className="drawer-body">
          <div className="field">
            <span className="field-label">
              <b>房间号</b>
              <span>支持短号</span>
            </span>
            <div className="field-inline">
              <input
                className="number-input"
                value={roomDraft}
                inputMode="numeric"
                onChange={(event) => setRoomDraft(event.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyRoom();
                }}
                aria-label="房间号"
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={applyRoom}>
                <IconPower size={14} />
                连接
              </button>
            </div>
          </div>

          <div className="drawer-group">
            <Switch
              label="自动连接"
              desc="打开页面时自动连接上次的房间"
              checked={settings.autoConnect}
              onChange={(value) => onChange({ autoConnect: value })}
            />
            <Switch
              label="演示模式"
              desc="使用本地回放数据，不连接 B 站，适合预览界面"
              checked={settings.demo}
              onChange={(value) => onChange({ demo: value })}
            />
            <Switch
              label="显示进场消息"
              desc="观众进入直播间、关注、分享等互动"
              checked={settings.showEnter}
              onChange={(value) => onChange({ showEnter: value })}
            />
            <Switch
              label="显示点赞消息"
              desc="谁为主播点了赞"
              checked={settings.showLike}
              onChange={(value) => onChange({ showLike: value })}
            />
          </div>

          <div className="drawer-group">
            <RangeField
              label="最多保留消息"
              value={settings.maxMessages}
              min={50}
              max={1000}
              step={50}
              suffix=" 条"
              onChange={(value) => onChange({ maxMessages: value })}
            />
            <RangeField
              label="弹幕字号"
              value={settings.fontSize}
              min={12}
              max={22}
              suffix=" px"
              onChange={(value) => onChange({ fontSize: value })}
            />
            <label className="field">
              <span className="field-label">
                <b>礼物浮层提示阈值</b>
                <span>金瓜子</span>
              </span>
              <input
                className="number-input"
                type="number"
                min={0}
                step={100}
                value={settings.giftToastMin}
                onChange={handleNumberChange}
              />
            </label>
          </div>

          <div className="drawer-actions">
            <button type="button" className="btn btn-ghost" onClick={onReset}>
              <IconRefresh size={14} />
              恢复默认
            </button>
          </div>

          <div className="drawer-status">
            <span>当前状态</span>
            <b>{status === 'live' ? '已连接' : status === 'reconnecting' ? '重连中' : status === 'error' ? '连接失败' : '未连接'}</b>
          </div>
        </div>

        <footer className="drawer-foot">{footer}</footer>
      </aside>
    </>
  );
}
