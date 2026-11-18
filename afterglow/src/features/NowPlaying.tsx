import { useEffect } from "react";
import { Plus, Link2, Play, Disc3, LocateFixed } from "lucide-react";
import { activeLine } from "../domain/lyrics";
import { useLyricFollow } from "../interactions/useLyricFollow";
import Cover from "../components/Cover";
import type { MusicController } from "./useMusic";
interface Props {
  active: boolean;
  music: MusicController;
  onClose(): void;
  onImport(): void;
  onRemote(): void;
  onSample(): void;
  onControlsHost(node: HTMLDivElement | null): void;
}
export default function NowPlaying({ active, music: m, onClose, onImport, onRemote, onSample, onControlsHost }: Props) {
  const track = m.current;
  const hasLyrics = !!track?.lyrics?.length;
  const currentLine = activeLine(track?.lyrics ?? [], m.state.time);
  const { scroller, lineRefs, browsing, browse, resume, onKeyDown } = useLyricFollow(
    track?.id, track?.lyrics, currentLine, m.state.seekVersion, active, .28,
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (active && e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, active]);
  return (
    <section className={`listening-screen ${hasLyrics ? "has-lyrics" : "without-lyrics"}`} aria-label="播放首页">
      <div className="listening-composition">
        <div className="listening-record">
          <div className="listening-artwork">
            {track ? <Cover playerRole="full" src={track.cover} index={m.tracks.indexOf(track)} large /> : <Disc3 size={72} strokeWidth={.7} />}
          </div>
        <div className="listening-details">
          <header className="listening-metadata">
            <h1 title={track?.title}>{track?.title ?? "音乐，从这里开始"}</h1>
            <div className="listening-byline">
              <span className="listening-artist" title={track?.artist}>{track?.artist ?? "本地的收藏，远端的旋律"}</span>
              {track?.album && <span className="listening-album" title={track.album}>{track.album}</span>}
            </div>
          </header>
          {track?.attribution && (
            <div className="listening-attribution">
              <a href={track.attribution.sourceUrl} target="_blank" rel="noreferrer">曲目来源</a><span>·</span>
              <a href={track.attribution.licenseUrl} target="_blank" rel="noreferrer">{track.attribution.license}</a>
            </div>
          )}
          {track && <div className="listening-controls-host" ref={onControlsHost} />}
          {!track && (
            <div className="listening-welcome">
              <button onClick={onImport} disabled={!m.ready || m.importing}><Plus size={18} />导入本地音乐</button>
              <button onClick={onRemote} disabled={!m.ready}><Link2 size={17} />添加远端链接</button>
              <button onClick={onSample} disabled={!m.ready}><Play size={14} />听一段原创试听</button>
            </div>
          )}
        </div>
        </div>
          {hasLyrics && track?.lyrics && (
            <div className="listening-lyrics">
              <div className={`listening-lyric-reader ${browsing ? "is-browsing" : ""}`}>
                <div className="listening-lyric-scroll" ref={scroller} onWheel={browse} onTouchStart={browse} onKeyDown={onKeyDown} onFocusCapture={browse} aria-label="同步歌词">
                  {track.lyrics.map((line, i) => (
                    <button ref={(el) => { lineRefs.current[i] = el; }} key={`${line.time}-${i}`} className={`listening-lyric-line ${i === currentLine ? "active" : ""}`} onClick={() => { m.seek(line.time); resume(); }} title="点击跳转到此句">{line.text}</button>
                  ))}
                </div>
                <button className="listening-follow" aria-hidden={!browsing} disabled={!browsing} tabIndex={browsing ? 0 : -1} onClick={resume}><LocateFixed size={14} />回到当前歌词</button>
              </div>
            </div>
          )}
      </div>
    </section>
  );
}
