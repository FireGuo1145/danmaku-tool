import { useCallback, useEffect, useRef, useState } from 'react';
import { Feed } from './components/Feed';
import { OverlayView } from './components/OverlayView';
import { StandaloneDanmaku } from './components/StandaloneDanmaku';
import { GiftToasts } from './components/GiftToasts';
import { RoomCard } from './components/RoomCard';
import { SettingsDrawer } from './components/SettingsDrawer';
import { ConnectionPanel, GiftRankPanel, StatsPanel } from './components/SidePanels';
import { TopBar } from './components/TopBar';
import { config } from './config';
import { defaultSettings, loadSettings, saveSettings, type Settings } from './lib/settings';
import { resolveRoute } from './lib/router';
import { useLiveRoom } from './lib/useLiveRoom';
import type { FeedFilter } from './types';

export default function App() {
  const route = resolveRoute();
  if (route.kind === 'overlay') {
    return route.mode === 'danmaku' ? <StandaloneDanmaku /> : <OverlayView mode={route.mode} />;
  }
  return <Dashboard />;
}

function Dashboard() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const live = useLiveRoom({ maxMessages: settings.maxMessages, demo: settings.demo });

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // 首次进入时按配置自动连接；URL 显式带 ?room= 时总是连接
  const startedRef = useRef(false);
  useEffect(() => {
    const hasRoomParam = new URLSearchParams(window.location.search).has('room');
    if ((!settings.autoConnect && !hasRoomParam) || startedRef.current) return;
    startedRef.current = true;
    live.connect(settings.roomId);
    return () => {
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换演示模式时立即换一种数据源
  const demoRef = useRef(settings.demo);
  useEffect(() => {
    if (demoRef.current === settings.demo) return;
    demoRef.current = settings.demo;
    live.connect(settings.roomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.demo]);

  const handleConnect = useCallback(
    (roomId: number) => {
      setSettings((previous) => (previous.roomId === roomId ? previous : { ...previous, roomId }));
      live.connect(roomId);
    },
    [live],
  );

  const handleDisconnect = useCallback(() => {
    live.disconnect();
  }, [live]);

  const handleSettingsChange = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => ({ ...previous, ...patch }));
  }, []);

  const handleReset = useCallback(() => {
    const next = defaultSettings();
    setSettings(next);
    live.clear();
    live.connect(next.roomId);
  }, [live]);

  const demoActive = settings.demo;
  const roomId = live.room?.roomId ?? settings.roomId;

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true">
        <span className="orb orb-pink" />
        <span className="orb orb-blue" />
        <span className="grid" />
      </div>

      <TopBar
        status={live.status}
        attempt={live.attempt}
        roomId={roomId}
        demo={demoActive}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onOpenSettings={() => setDrawerOpen(true)}
      />

      <main className="layout">
        <div className="col-main">
          <RoomCard
            room={live.room}
            stats={live.stats}
            liveStatus={live.liveStatus}
            status={live.status}
            demo={demoActive}
          />
          <Feed
            messages={live.messages}
            filter={filter}
            onFilterChange={setFilter}
            showEnter={settings.showEnter}
            showLike={settings.showLike}
            fontSize={settings.fontSize}
            autoScroll={autoScroll}
            onToggleAutoScroll={() => setAutoScroll((previous) => !previous)}
            onClear={live.clear}
            status={live.status}
            error={live.error}
            attempt={live.attempt}
            onRetry={live.reconnect}
            demo={demoActive}
            quickRooms={config.quickRooms}
            onQuickRoom={handleConnect}
          />
        </div>

        <aside className="col-side">
          <StatsPanel stats={live.stats} rate={live.rate} room={live.room} liveStatus={live.liveStatus} />
          <GiftRankPanel ranks={live.gifts} />
          <ConnectionPanel
            status={live.status}
            room={live.room}
            info={live.connectionInfo}
            startedAt={live.startedAt}
            attempt={live.attempt}
            warnings={live.warnings}
            demo={demoActive}
          />
          <p className="side-note">
            数据接口：<code>{config.apiBase}</code> · 协议 protover {config.protover}
            <br />
            OBS 嵌入：<a href={`/danmaku?room=${roomId}`}>/danmaku</a> ·
            <a href={`/gift?room=${roomId}`}>/gift</a> ·
            <a href={`/superchat?room=${roomId}`}>/superchat</a> ·
            <a href={`/stats?room=${roomId}`}>/stats</a>
            <br />
            仅用于学习交流，弹幕版权归 B 站与主播所有
          </p>
        </aside>
      </main>

      <GiftToasts toasts={live.toasts} />

      <SettingsDrawer
        open={drawerOpen}
        settings={settings}
        status={live.status}
        onChange={handleSettingsChange}
        onApplyRoom={handleConnect}
        onReset={handleReset}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            房间号、登录态等可写在项目根目录 <code>.env</code> 中（VITE_ 前缀），
            修改后重启 <code>yarn dev</code>。
          </>
        }
      />
    </div>
  );
}
