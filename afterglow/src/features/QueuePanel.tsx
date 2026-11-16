import { X, Trash2, AudioLines, ListMusic, Play } from "lucide-react";
import Cover from "../components/Cover";
import { formatTime } from "../domain/types";
import type { MusicController } from "./useMusic";
export default function QueuePanel({
  music: m,
  onClose,
}: {
  music: MusicController;
  onClose(): void;
}) {
  return (
    <aside className="queue-panel">
      <header>
        <div>
          <h2>当前播放</h2>
          <span>共 {m.queue.length} 首音乐</span>
        </div>
        <button className="icon-button" aria-label="关闭队列" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="queue-toolbar">
        <span>播放队列</span>
        <button disabled={!m.queue.length} onClick={m.clearQueue}>
          <Trash2 size={13} />
          清空
        </button>
      </div>
      <div className="queue-list">
        {m.queue.length ? (
          m.queue.map((id) => {
            const track = m.tracks.find((t) => t.id === id)!;
            return (
              <div
                className={`queue-item ${id === m.state.trackId ? "active" : ""}`}
                key={id}
              >
                <button className="queue-song" onClick={() => m.play(track)}>
                  <Cover src={track.cover} index={m.tracks.indexOf(track)} />
                  <span>
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </span>
                </button>
                {id === m.state.trackId ? (
                  <AudioLines size={17} />
                ) : (
                  <span className="queue-time">
                    {track.duration ? formatTime(track.duration) : "--:--"}
                  </span>
                )}
                <button
                  className="icon-button"
                  aria-label={`从队列移除 ${track.title}`}
                  onClick={() => m.removeFromQueue(id)}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })
        ) : (
          <div className="empty">
            <ListMusic size={32} />
            <h3>队列里还没有音乐</h3>
            <p>播放歌曲，或选择“下一首播放”</p>
            <Play size={15} />
          </div>
        )}
      </div>
    </aside>
  );
}
