import {
  AudioLines,
  Heart,
  Play,
  MoreHorizontal,
  CornerDownRight,
  Trash2,
  FileMusic,
  Plus,
  Pencil,
  Music2,
  Upload,
} from "lucide-react";
import Cover from "../components/Cover";
import { formatTime } from "../domain/types";
import type { Track } from "../domain/types";
import { available } from "../sources";
import type { MusicController } from "./useMusic";
interface Props {
  music: MusicController;
  tracks: Track[];
  onImport(): void;
  onLyrics(id: string): void;
  onEdit(track: Track): void;
  onCreatePlaylist(): void;
  playlistId?: string;
  onRemoveFromPlaylist?(id: string): void;
}
export default function TrackList({
  music: m,
  tracks,
  onImport,
  onLyrics,
  onEdit,
  onCreatePlaylist,
  playlistId,
  onRemoveFromPlaylist,
}: Props) {
  const ids = tracks.filter(available).map((t) => t.id);
  return (
    <div className="track-table">
      <div className="table-header">
        <span>#</span>
        <span>歌曲标题</span>
        <span>歌手</span>
        <span>专辑</span>
        <span>时长</span>
        <span />
      </div>
      {tracks.length ? (
        tracks.map((track, i) => (
          <div
            className={`track-row ${m.state.trackId === track.id ? "current" : ""} ${!available(track) ? "unavailable" : ""}`}
            key={track.id}
            onDoubleClick={() => m.play(track, ids)}
          >
            <div className="track-number">
              <button
                className="row-play-button"
                aria-label={`播放 ${track.title}`}
                onClick={() =>
                  m.state.trackId === track.id ? m.toggle() : m.play(track, ids)
                }
              >
                {m.state.trackId === track.id &&
                m.state.status === "playing" ? (
                  <AudioLines size={17} />
                ) : (
                  <>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <Play size={13} fill="currentColor" />
                  </>
                )}
              </button>
            </div>
            <div className="track-title-cell">
              <button
                className={`icon-button favorite ${track.favorite ? "liked" : ""}`}
                aria-label={`${track.favorite ? "取消收藏" : "收藏"} ${track.title}`}
                onClick={() => m.favorite(track.id)}
              >
                <Heart
                  size={15}
                  fill={track.favorite ? "currentColor" : "none"}
                />
              </button>
              <button
                className="track-title"
                onClick={() => m.play(track, ids)}
              >
                <Cover src={track.cover} index={i} />
                <span>
                  <strong>{track.title}</strong>
                  <small>
                    {!available(track)
                      ? "需重新导入"
                      : track.source.kind === "local"
                        ? "本地文件"
                        : "远端音频"}
                    {track.source.kind === "remote" && !track.persist
                      ? " · 临时"
                      : ""}
                  </small>
                </span>
              </button>
            </div>
            <span className="track-artist" title={track.artist}>
              {track.artist}
            </span>
            <span className="track-album" title={track.album}>
              {track.album || "未知专辑"}
            </span>
            <span className="track-time">
              {track.duration ? formatTime(track.duration) : "--:--"}
            </span>
            <details
              className="track-menu"
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <summary aria-label={`更多操作 ${track.title}`}>
                <MoreHorizontal size={18} />
              </summary>
              <div
                className="context-menu"
                onClick={(e) => {
                  const details = e.currentTarget.closest("details");
                  if (!(e.target as HTMLElement).closest("summary"))
                    details?.removeAttribute("open");
                }}
              >
                <button onClick={() => m.playNext(track)}>
                  <CornerDownRight size={15} />
                  下一首播放
                </button>
                <button onClick={() => onEdit(track)}>
                  <Pencil size={15} />
                  编辑歌曲信息
                </button>
                <button onClick={() => onLyrics(track.id)}>
                  <FileMusic size={15} />
                  导入 LRC 歌词
                </button>
                <div className="menu-separator" />
                <span className="menu-label">添加到歌单</span>
                {m.playlists.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => m.addToPlaylist(p.id, track.id)}
                  >
                    <Music2 size={14} />
                    {p.name}
                  </button>
                ))}
                <button onClick={onCreatePlaylist}>
                  <Plus size={15} />
                  新建歌单
                </button>
                <div className="menu-separator" />
                {playlistId && (
                  <button onClick={() => onRemoveFromPlaylist?.(track.id)}>
                    <Trash2 size={15} />
                    从歌单移除
                  </button>
                )}
                <button
                  className="danger"
                  onClick={() => m.removeTrack(track.id)}
                >
                  <Trash2 size={15} />
                  从音乐库移除
                </button>
              </div>
            </details>
          </div>
        ))
      ) : (
        <div className="empty library-empty">
          <div className="empty-symbol">
            <Music2 size={31} strokeWidth={1.3} />
          </div>
          <h3>这里还没有音乐</h3>
          <p>导入本地音频，或添加远端音频直链</p>
          <button className="primary" onClick={onImport}>
            <Upload size={15} />
            导入本地音乐
          </button>
          <small>也可以直接拖放文件到此窗口</small>
        </div>
      )}
    </div>
  );
}
