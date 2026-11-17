import { Play, Shuffle, Repeat1, Heart, FolderOpen, Link2, Clock3, Disc3 } from "lucide-react";
import type { Track, PlayMode } from "../domain/types";
import { available } from "../sources";
import type { MusicController } from "./useMusic";
interface Props { music: MusicController; onPlay(): void }
export default function ListeningModes({ music: m, onPlay }: Props) {
  const usable = m.tracks.filter(available);
  const favorites = usable.filter((t) => t.favorite);
  const recent = usable.filter((t) => t.lastPlayed).sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));
  const local = usable.filter((t) => t.source.kind === "local");
  const remote = usable.filter((t) => t.source.kind === "remote");
  function start(tracks: Track[], mode: PlayMode = "sequence") {
    if (!tracks.length) return;
    const first = mode === "shuffle" ? tracks[Math.floor(Math.random() * tracks.length)] : tracks[0];
    m.setMode(mode);
    m.play(first, tracks.map((t) => t.id));
    onPlay();
  }
  const shortcuts = [
    { title: "顺序播放", Icon: Play, tracks: usable, mode: "sequence" as const },
    { title: "随机漫游", Icon: Shuffle, tracks: usable, mode: "shuffle" as const },
    { title: "单曲循环", Icon: Repeat1, tracks: m.current && available(m.current) ? [m.current] : usable.slice(0, 1), mode: "repeat-one" as const },
    { title: "我的喜欢", Icon: Heart, tracks: favorites, mode: "sequence" as const },
    { title: "本地收藏", Icon: FolderOpen, tracks: local, mode: "sequence" as const },
    { title: "远端音乐", Icon: Link2, tracks: remote, mode: "sequence" as const },
  ];
  const albums = [...new Set(usable.map((t) => t.album || "未知专辑"))].map((album) => ({ title: album, tracks: usable.filter((t) => (t.album || "未知专辑") === album), subtitle: "专辑" }));
  const cards = [
    { title: "随心听", tracks: usable, subtitle: "从你的音乐库随机出发", mode: "shuffle" as PlayMode },
    { title: "最近在听", tracks: recent, subtitle: "再听一次熟悉的旋律", mode: "sequence" as PlayMode },
    { title: "我喜欢的音乐", tracks: favorites, subtitle: "收藏的旋律，慢慢听", mode: "sequence" as PlayMode },
    ...albums.map((a) => ({ ...a, mode: "sequence" as PlayMode })),
    ...m.playlists.map((p) => ({ title: p.name, subtitle: "我的歌单", tracks: usable.filter((t) => p.trackIds.includes(t.id)), mode: "sequence" as PlayMode })),
  ];
  return (
    <section className="modes-page content">
      <h1>听歌模式</h1>
      <h2>常用模式</h2>
      <div className="mode-shortcuts">
        {shortcuts.map(({ title, Icon, tracks, mode }) => (
          <button key={title} disabled={!m.ready || !tracks.length} onClick={() => start(tracks, mode)}><Icon size={19} /><span>{title}</span></button>
        ))}
      </div>
      <h2>从你的音乐开始</h2>
      <div className="mode-card-grid">
        {cards.map((card, i) => {
          const cover = card.tracks.find((t) => t.cover)?.cover;
          return (
            <button className={`mode-card mode-card-${i % 6}`} key={`${card.title}-${i}`} disabled={!m.ready || !card.tracks.length} onClick={() => start(card.tracks, card.mode)}>
              {cover && <img className="mode-card-image" src={cover} alt="" loading="lazy" />}
              <span className="mode-card-shade" />
              {!cover && (i === 1 ? <Clock3 className="mode-card-symbol" /> : <Disc3 className="mode-card-symbol" />)}
              <span className="mode-card-copy"><strong>{card.title}</strong><small>{card.tracks.length ? `${card.subtitle} · ${card.tracks.length} 首` : "还没有可播放的歌曲"}</small></span>
              <span className="mode-card-play"><Play size={21} fill="currentColor" /></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
