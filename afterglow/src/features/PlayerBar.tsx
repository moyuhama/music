import { useRef } from "react";
import {
  AudioLines,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  ListMusic,
  LoaderCircle,
  ChevronUp,
} from "lucide-react";
import { formatTime } from "../domain/types";
import { player } from "../player/engine";
import Cover from "../components/Cover";
import type { MusicController } from "./useMusic";
export default function PlayerBar({
  music: m,
  openDetail,
  openQueue,
  queueOpen,
}: {
  music: MusicController;
  openDetail(): void;
  openQueue(): void;
  queueOpen: boolean;
}) {
  const { state, current } = m;
  const lastVolume = useRef(0.7);
  const playing = state.status === "playing";
  const loading = state.status === "loading";
  return (
    <section className="player-bar" aria-label="播放控制">
      <div className="now-playing">
        <button
          className="now-art"
          aria-label="打开播放详情"
          disabled={!current}
          onClick={openDetail}
        >
          {current ? (
            <Cover
              playerRole="mini"
              src={current.cover}
              index={m.tracks.indexOf(current)}
            />
          ) : (
            <div className="idle-cover">
              <AudioLines size={25} />
            </div>
          )}
          <span>
            <ChevronUp size={19} />
          </span>
        </button>
        <div className="now-info">
          <button disabled={!current} onClick={openDetail}>
            {current?.title ?? "还没有正在播放的音乐"}
          </button>
          <small>{current?.artist ?? "导入音乐，开始聆听"}</small>
        </div>
        {current && (
          <button
            className={`icon-button favorite ${current.favorite ? "liked" : ""}`}
            aria-label="收藏当前音乐"
            onClick={() => m.favorite(current.id)}
          >
            <Heart
              size={18}
              fill={current.favorite ? "currentColor" : "none"}
            />
          </button>
        )}
      </div>
      <div className="playback-center">
        <div className="playback-buttons">
          <button
            className={`icon-button mode-button ${m.mode !== "sequence" ? "on" : ""}`}
            aria-label={`播放模式：${m.mode === "sequence" ? "顺序" : m.mode === "shuffle" ? "随机" : "单曲循环"}，点击切换`}
            onClick={() =>
              m.setMode(
                m.mode === "sequence"
                  ? "repeat-one"
                  : m.mode === "repeat-one"
                    ? "shuffle"
                    : "sequence",
              )
            }
          >
            {m.mode === "shuffle" ? (
              <Shuffle size={17} />
            ) : m.mode === "repeat-one" ? (
              <Repeat1 size={17} />
            ) : (
              <Repeat size={17} />
            )}
          </button>
          <button
            className="icon-button"
            aria-label="上一首"
            disabled={!m.queue.length}
            onClick={m.previous}
          >
            <SkipBack size={20} fill="currentColor" />
          </button>
          <button
            className="play-main"
            aria-label={playing || loading ? "暂停" : "播放"}
            onClick={m.toggle}
          >
            {loading ? (
              <LoaderCircle className="spin" size={21} />
            ) : playing ? (
              <Pause size={21} fill="currentColor" />
            ) : (
              <Play size={21} fill="currentColor" />
            )}
          </button>
          <button
            className="icon-button"
            aria-label="下一首"
            disabled={!m.queue.length}
            onClick={() => m.next()}
          >
            <SkipForward size={20} fill="currentColor" />
          </button>
          <button
            className="lyric-button"
            aria-label="打开歌词"
            onClick={openDetail}
            disabled={!current}
          >
            词
          </button>
        </div>
        <div className="progress-row">
          <span>{formatTime(state.time)}</span>
          <input
            aria-label="播放进度"
            type="range"
            min="0"
            max={state.duration || 1}
            step="0.1"
            value={Math.min(state.time, state.duration || 1)}
            disabled={!state.duration}
            onChange={(e) => m.seek(Number(e.target.value))}
            style={
              {
                "--progress": `${state.duration ? (state.time / state.duration) * 100 : 0}%`,
              } as React.CSSProperties
            }
          />
          <span>{formatTime(state.duration)}</span>
        </div>
      </div>
      <div className="player-extra">
        <button
          className="icon-button"
          aria-label={state.volume ? "静音" : "取消静音"}
          onClick={() => {
            if (state.volume) {
              lastVolume.current = state.volume;
              player.setVolume(0);
            } else player.setVolume(lastVolume.current || 0.7);
          }}
        >
          {state.volume ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <input
          aria-label="音量"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={state.volume}
          onChange={(e) => player.setVolume(Number(e.target.value))}
        />
        <span className="player-divider" />
        <button
          className={`icon-button queue-trigger ${queueOpen ? "on" : ""}`}
          aria-label="播放队列"
          onClick={openQueue}
        >
          <ListMusic size={21} />
          <small>{m.queue.length}</small>
        </button>
      </div>
    </section>
  );
}
