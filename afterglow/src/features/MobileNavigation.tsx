import { useEffect, useRef, useState } from "react";
import {
  Menu,
  Compass,
  Settings,
  X,
  AudioLines,
  Library,
  Heart,
  Clock3,
  FolderOpen,
  Link2,
  ListMusic,
  Plus,
  Check,
  Volume2,
} from "lucide-react";
import type { Playlist, View } from "../domain/types";
interface Props {
  hasResources: boolean;
  view: View;
  isPlayer: boolean;
  playlists: Playlist[];
  queueCount: number;
  volume: number;
  onQueue(): void;
  onVolume(value: number): void;
  onPlayer(): void;
  onView(view: View): void;
  onCreate(): void;
}
export default function MobileNavigation({
  hasResources,
  view,
  isPlayer,
  playlists,
  queueCount,
  volume,
  onQueue,
  onVolume,
  onPlayer,
  onView,
  onCreate,
}: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const items = [
    ...(hasResources ? [{ view: "discovery" as const, name: "发现", Icon: Compass }] : []),
    { view: "modes" as const, name: "听歌模式", Icon: Compass },
    { view: "all" as const, name: "全部音乐", Icon: Library },
    { view: "favorites" as const, name: "我喜欢的音乐", Icon: Heart },
    { view: "recent" as const, name: "最近播放", Icon: Clock3 },
    { view: "local" as const, name: "本地音乐", Icon: FolderOpen },
    { view: "remote" as const, name: "远端音频", Icon: Link2 },
    { view: "settings" as const, name: "设置", Icon: Settings },
  ];
  return (
    <div
      className="mobile-navigation"
      ref={root}
      onBlur={(e) => {
        if (
          e.relatedTarget &&
          !e.currentTarget.contains(e.relatedTarget as Node)
        )
          setOpen(false);
      }}
    >
      <button
        className="icon-button"
        aria-label={open ? "关闭导航菜单" : "打开导航菜单"}
        aria-expanded={open}
        aria-controls="mobile-music-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <nav
          id="mobile-music-navigation"
          className="mobile-navigation-panel"
          aria-label="音乐导航"
        >
          <span className="mobile-menu-label">我的音乐</span>
          <button
            className={isPlayer ? "selected" : ""}
            onClick={() => {
              onPlayer();
              setOpen(false);
            }}
          >
            <AudioLines size={18} />
            <span>播放器</span>
            {isPlayer && <Check size={14} />}
          </button>
          {items.map(({ view: value, name, Icon }) => (
            <button
              key={value}
              className={!isPlayer && view === value ? "selected" : ""}
              onClick={() => {
                onView(value);
                setOpen(false);
              }}
            >
              <Icon size={17} />
              <span>{name}</span>
              {!isPlayer && view === value && <Check size={14} />}
            </button>
          ))}
          <div className="mobile-menu-divider" />
          <span className="mobile-menu-label">播放设置</span>
          <button
            onClick={() => {
              onQueue();
              setOpen(false);
            }}
          >
            <ListMusic size={17} />
            <span>播放队列</span>
            <small>{queueCount}</small>
          </button>
          <label className="mobile-volume">
            <Volume2 size={17} />
            <span>音量</span>
            <input
              aria-label="播放音量"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => onVolume(Number(e.target.value))}
            />
          </label>
          <div className="mobile-menu-divider" />
          <span className="mobile-menu-label">我的歌单</span>
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onView(`playlist:${p.id}`);
                setOpen(false);
              }}
            >
              <ListMusic size={17} />
              <span>{p.name}</span>
            </button>
          ))}
          <button
            onClick={() => {
              onCreate();
              setOpen(false);
            }}
          >
            <Plus size={17} />
            <span>新建歌单</span>
          </button>
        </nav>
      )}
    </div>
  );
}
