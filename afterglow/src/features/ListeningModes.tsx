import { Disc3, ListMusic } from "lucide-react";
import type { Track } from "../domain/types";
import type { MusicController } from "./useMusic";

interface Props {
  music: MusicController;
  onOpenAlbum(album: string): void;
  onOpenPlaylist(id: string): void;
}
type CollectionCard = {
  id: string;
  title: string;
  tracks: Track[];
} & ({ kind: "album"; album: string } | { kind: "playlist"; playlistId: string });

export default function ListeningModes({ music: m, onOpenAlbum, onOpenPlaylist }: Props) {
  const albumTracks = new Map<string, Track[]>();
  for (const track of m.tracks) {
    if (!track.album?.trim() || track.album === "未知专辑") continue;
    const tracks = albumTracks.get(track.album) ?? [];
    tracks.push(track);
    albumTracks.set(track.album, tracks);
  }
  const trackById = new Map(m.tracks.map((track) => [track.id, track]));
  const cards: CollectionCard[] = [
    ...Array.from(albumTracks, ([album, tracks]) => ({ id: `album:${album}`, title: album, tracks, kind: "album" as const, album })),
    ...m.playlists.map((playlist) => ({
      id: `playlist:${playlist.id}`, title: playlist.name, kind: "playlist" as const, playlistId: playlist.id,
      tracks: playlist.trackIds.flatMap((id) => { const track = trackById.get(id); return track ? [track] : []; }),
    })),
  ];
  return (
    <section className="modes-page content">
      <h1>听歌模式</h1>
      <div className="mode-card-grid" aria-label="专辑与歌单">
        {cards.map((card, i) => {
          const cover = card.tracks.find((track) => track.cover)?.cover;
          const kind = card.kind === "album" ? (card.tracks.every(track=>track.source.kind === "local" || track.origin?.kind === "bundled") ? "本地专辑" : "专辑") : "歌单";
          const Symbol = card.kind === "album" ? Disc3 : ListMusic;
          return (
            <button
              className={`mode-card mode-card-${i % 6}`}
              key={card.id}
              aria-label={`打开${kind} ${card.title}`}
              disabled={!m.ready}
              onClick={() => card.kind === "album" ? onOpenAlbum(card.album) : onOpenPlaylist(card.playlistId)}
            >
              {cover && <img className="mode-card-image" src={cover} alt="" loading="lazy" />}
              <span className="mode-card-shade" />
              {!cover && <Symbol className="mode-card-symbol" />}
              <span className="mode-card-kind">{kind}</span>
              <span className="mode-card-copy"><strong>{card.title}</strong><small>{card.tracks.length} 首歌曲</small></span>
            </button>
          );
        })}
      </div>
      {m.ready && !cards.length && <p className="modes-empty">还没有专辑或歌单</p>}
    </section>
  );
}
