import { useEffect } from "react";
import {
  Heart,
  FileMusic,
  Plus,
  Link2,
  Play,
  Disc3,
  LocateFixed,
} from "lucide-react";
import { activeLine } from "../domain/lyrics";
import { useLyricFollow } from "../interactions/useLyricFollow";
import Cover from "../components/Cover";
import type { MusicController } from "./useMusic";
interface Props {
  active: boolean;
  music: MusicController;
  onClose(): void;
  onLyrics(id: string): void;
  onImport(): void;
  onRemote(): void;
  onSample(): void;
}
export default function NowPlaying({
  active,
  music: m,
  onClose,
  onLyrics,
  onImport,
  onRemote,
  onSample,
}: Props) {
  const track = m.current;
  const currentLine = activeLine(track?.lyrics ?? [], m.state.time);
  const { scroller, lineRefs, browsing, browse, resume, onKeyDown } =
    useLyricFollow(
      track?.id,
      track?.lyrics,
      currentLine,
      m.state.seekVersion,
      active,
    );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (active && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, active]);
  return (
    <section
      className={`now-page ${track && !track.lyrics?.length ? "without-lyrics" : ""}`}
      aria-label="播放首页"
    >
      <div
        className="now-backdrop"
        style={
          track?.cover
            ? { backgroundImage: `url("${track.cover}")` }
            : undefined
        }
      />
      <div className={`listening-layout ${!track ? "no-track" : ""}`}>
        <div className="record-side">
          <button
            className="large-artwork section-enter"
            key={track?.id ?? "empty"}
            type="button"
            aria-label="收起播放器"
            title="返回音乐库"
            onClick={onClose}
          >
            {track ? (
              <Cover
                playerRole="full"
                src={track.cover}
                index={m.tracks.indexOf(track)}
                large
              />
            ) : (
              <div className="artwork-placeholder">
                <Disc3 size={104} strokeWidth={0.6} />
                <span>YOUR MUSIC STARTS HERE</span>
              </div>
            )}
          </button>
          <div className="record-actions">
            {track ? (
              <>
                <button
                  className={`glass-button ${track.favorite ? "liked" : ""}`}
                  aria-label="播放详情收藏"
                  onClick={() => m.favorite(track.id)}
                >
                  <Heart
                    size={19}
                    fill={track.favorite ? "currentColor" : "none"}
                  />
                </button>
                <button
                  className="glass-button"
                  onClick={() => onLyrics(track.id)}
                >
                  <FileMusic size={18} />
                  导入歌词
                </button>
              </>
            ) : (
              <button
                className="glass-button"
                onClick={onSample}
                disabled={!m.ready}
              >
                <Play size={14} />
                听一段原创试听
              </button>
            )}
          </div>
        </div>
        <div className="lyrics-side">
          <div className="song-heading" key={track?.id ?? "empty"}>
            <span className="listening-eyebrow">
              {track ? "NOW PLAYING" : "WELCOME TO AFTERGLOW"}
            </span>
            <h1>{track?.title ?? "音乐，从这里开始"}</h1>
            {track ? (
              <p>
                <span>歌手</span>
                {track.artist}
                <span>专辑</span>
                {track.album || "未知专辑"}
              </p>
            ) : (
              <p>本地的收藏，远端的旋律，在这里播放。</p>
            )}
          </div>
          {track?.attribution && (
            <div className="track-attribution">
              <a
                href={track.attribution.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {track.title} — {track.artist}
              </a>
              <span>·</span>
              <a
                href={track.attribution.licenseUrl}
                target="_blank"
                rel="noreferrer"
              >
                {track.attribution.license}
              </a>
            </div>
          )}
          {track?.lyrics?.length ? (
            <div className={`lyric-reader ${browsing ? "is-browsing" : ""}`}>
              <div
                className="lyrics-scroll"
                ref={scroller}
                onWheel={browse}
                onTouchStart={browse}
                onKeyDown={onKeyDown}
                onFocusCapture={browse}
                aria-label="同步歌词"
              >
                {track.lyrics.map((line, i) => (
                  <button
                    ref={(el) => {
                      lineRefs.current[i] = el;
                    }}
                    key={`${line.time}-${i}`}
                    className={`lyric-line ${i === currentLine ? "active" : ""}`}
                    onClick={() => {
                      m.seek(line.time);
                      resume();
                    }}
                    title="点击跳转到此句"
                  >
                    {line.text}
                  </button>
                ))}
              </div>
              <button
                className="follow-current"
                aria-hidden={!browsing}
                disabled={!browsing}
                tabIndex={browsing ? 0 : -1}
                onClick={resume}
              >
                <LocateFixed size={14} />
                回到当前歌词
              </button>
            </div>
          ) : track ? null : (
            <div className="player-welcome">
              <button
                onClick={onImport}
                className="welcome-primary"
                disabled={!m.ready || m.importing}
              >
                <Plus size={18} />
                导入本地音乐
              </button>
              <button
                onClick={onRemote}
                className="welcome-secondary"
                disabled={!m.ready}
              >
                <Link2 size={17} />
                添加远端链接
              </button>
              <p>也可以把音频文件拖到这个窗口</p>
              <small>MP3 / FLAC / WAV / M4A</small>
            </div>
          )}
        </div>
      </div>
      <div className="listening-footer">
        <span
          className={
            m.state.status === "playing" ? "live-dots playing" : "live-dots"
          }
        >
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>
          {track
            ? m.state.status === "playing"
              ? "享受此刻的音乐"
              : m.state.status === "loading"
                ? "正在载入音乐…"
                : "点击下方播放，继续聆听"
            : "你的私人聆听空间"}
        </span>
        <span className="keyboard-hint">SPACE 播放 / 暂停</span>
      </div>
    </section>
  );
}
