import {useEffect,useRef,useState} from "react";
import { Disc3, ListMusic, Trash2, Plus } from "lucide-react";
import type { Track } from "../domain/types";
import type { MusicController } from "./useMusic";

interface Props {
  music: MusicController;
  onOpenAlbum(album: string): void;
  onCreateAlbum():void;
  onOpenPlaylist(id: string): void;
}
type CollectionCard = {
  id: string;
  title: string;
  tracks: Track[];
} & ({ kind: "album"; album: string } | { kind: "playlist"; playlistId: string });

export default function ListeningModes({ music: m, onOpenAlbum, onOpenPlaylist, onCreateAlbum }: Props) {
  // Sidebar motion changes card widths, while viewport resizing controls column count.
  const gridColumns=()=>window.innerWidth<=820?2:Math.max(1,Math.floor((window.innerWidth-260+16)/186));
  const [columns,setColumns]=useState(gridColumns);
  useEffect(()=>{const resize=()=>setColumns(gridColumns());window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  const [removing,setRemoving]=useState<CollectionCard|null>(null);
  const albumTracks = new Map<string, Track[]>();
  for (const track of m.tracks) {
    if (!track.album?.trim() || track.album === "未知专辑") continue;
    const tracks = albumTracks.get(track.album) ?? [];
    tracks.push(track);
    albumTracks.set(track.album, tracks);
  }
  for(const album of m.albums)if(!albumTracks.has(album.name))albumTracks.set(album.name,[]);
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
      <div className="mode-card-grid" aria-label="专辑与歌单" style={{"--mode-columns":columns} as React.CSSProperties}>
        {cards.map((card, i) => {
          const cover = (card.kind==='album'?m.albums.find(album=>album.name===card.album)?.cover:undefined)||card.tracks.find((track) => track.cover)?.cover;
          const kind = card.kind === "album" ? (card.tracks.length>0 && card.tracks.every(track=>track.source.kind === "local" || (track.origin?.kind === "bundled" && !track.origin.hosted)) ? "本地专辑" : "专辑") : "歌单";
          const Symbol = card.kind === "album" ? Disc3 : ListMusic;
          return (
            <div className="mode-card-wrapper" key={card.id}>
            <button
              className={`mode-card mode-card-${i % 6}`}
              aria-label={card.kind==='album'&&!card.tracks.length?`导入音乐到专辑 ${card.title}`:`${card.kind==='album'?'播放':'打开'}${kind} ${card.title}`}
              disabled={!m.ready}
              onClick={() => card.kind === "album" ? onOpenAlbum(card.album) : onOpenPlaylist(card.playlistId)}
            >
              {cover && <img className="mode-card-image" src={cover} alt="" loading="lazy" />}
              <span className="mode-card-shade" />
              {!cover && <Symbol className="mode-card-symbol" />}
              <span className="mode-card-kind">{kind}</span>
              <span className="mode-card-copy"><strong>{card.title}</strong><small>{card.tracks.length} 首歌曲</small></span>
            </button>
            <button className="mode-card-remove" aria-label={`移除${card.kind==='album'?'专辑':'歌单'} ${card.title}`} title="从音乐库移除" onClick={()=>setRemoving(card)}><Trash2 size={15}/></button>
            </div>
          );
        })}
        <div className={`mode-add-slot ${!cards.length?'is-empty':''}`}>
          <button className="mode-add-album" aria-label="添加专辑" title="添加专辑" disabled={!m.ready} onClick={onCreateAlbum}><Plus size={30} strokeWidth={1.4}/></button>
        </div>
      </div>
      {removing&&<RemoveCollectionDialog card={removing} onClose={()=>setRemoving(null)} onRemove={()=>{if(removing.kind==='album')m.removeAlbum(removing.album);else m.removePlaylist(removing.playlistId);setRemoving(null);}}/>}
      {m.ready && !cards.length && <p className="modes-empty">还没有专辑或歌单</p>}
    </section>
  );
}

function RemoveCollectionDialog({card,onClose,onRemove}:{card:CollectionCard;onClose():void;onRemove():void}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);
 return <dialog className="form-dialog" ref={ref} onCancel={onClose}>
  <form onSubmit={event=>{event.preventDefault();onRemove();}}>
   <h2>移除{card.kind==='album'?'专辑':'歌单'}</h2>
   <p>「{card.title}」</p>
   <p>{card.kind==='album'?`将从当前音乐库移除其中的 ${card.tracks.length} 首歌曲，音频源文件保留。`:'移除这个歌单，歌曲仍保留在音乐库中。'}</p>
   <div className="collection-dialog-actions"><button type="button" onClick={onClose}>取消</button><button type="submit" className="primary">确认移除</button></div>
  </form>
 </dialog>;
}
