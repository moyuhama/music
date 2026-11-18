import {saveLocalFile,loadLocalFile,removeLocalFile} from "../storage/local-files";
import {loadBundledLibrary} from "./bundled-library";
import {libraryTrack,migratePlaybackHistory,mergeBundled,reconcileLegacyCatalog,remapTrackIds} from "../domain/library";
import type {ResourcePlayback} from "./ResourceDiscovery";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Track, PlayMode, Playlist } from "../domain/types";
import { nextId, insertNext } from "../domain/types";
import { player } from "../player/engine";
import { libraryRepository } from "../storage";
import { available, registerFile, forgetFile } from "../sources";
import { readMetadata } from "./import-metadata";
import { parseLrc, removeDemoLyrics } from "../domain/lyrics";
import { mergeCatalog } from "../domain/catalog";
export function useMusic() {
  const [catalogIds, setCatalogIds] = useState<string[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [mode, setMode] = useState<PlayMode>("sequence");
  const [ready, setReady] = useState(false);
  const [importing, setImporting] = useState(false);
  const [toast, notify] = useState("");
  const history = useRef<string[]>([]);
  const importLock = useRef(false);
  const state = useSyncExternalStore(player.subscribe, player.snapshot);
  const current = tracks.find((t) => t.id === state.trackId);
  const ids = queue.filter((id) =>
    tracks.some((t) => t.id === id && available(t)),
  );
  useEffect(() => {
    let live = true;
    libraryRepository
      .load()
      .catch(() => {
        if (live) notify("本机存储不可用，仍可在本次打开期间听歌。");
        return undefined;
      })
      .then(async (saved) => {
        if (!live) return;
        const savedTracks=migratePlaybackHistory((saved?.tracks??[]).map(removeDemoLyrics),saved?.playlists??[]);
        await Promise.all(savedTracks.filter(t=>t.source.kind==='local').map(async(track)=>{
          if(track.source.kind!=='local')return;
          try{const blob=await loadLocalFile(track.source.fileKey);if(blob&&live)registerFile(track.source.fileKey,new File([blob],track.source.fileName||track.title,{type:blob.type,lastModified:track.source.modified}));}catch{}
        }));
        const base=mergeCatalog(savedTracks,saved?.catalogIds??[]);
        const bundled=await loadBundledLibrary(base.tracks);if(!live)return;
        const reconciled=bundled?reconcileLegacyCatalog(base.tracks,bundled):{tracks:base.tracks,aliases:new Map<string,string>()};
        const merged=bundled?mergeBundled(reconciled.tracks,bundled,base.catalogIds):base;
        setTracks(merged.tracks);
        setCatalogIds(merged.catalogIds);
        if (saved) {
          setPlaylists((saved.playlists ?? []).map(list=>({...list,trackIds:remapTrackIds(list.trackIds,reconciled.aliases)})));
          setQueue(remapTrackIds(saved.queue ?? [],reconciled.aliases));
          setMode(saved.mode);
          player.setVolume(saved.volume);
          const selected =
            merged.tracks.find((t) => t.id === (reconciled.aliases.get(saved.currentId??"")??saved.currentId)) ??
            [...merged.tracks]
              .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
              .find(available) ??
            merged.tracks[0];
          if (selected)
            player.select(
              merged.tracks.find((t) => t.id === selected.id) ?? selected,
            );
        } else if (merged.tracks[0]) player.select(merged.tracks[0]);
      })
      .catch(() => {
        if (live) notify("本机存储不可用，仍可在本次打开期间听歌。");
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      libraryRepository
        .save({
          tracks,
          catalogIds,
          playlists,
          queue,
          mode,
          volume: state.volume,
          currentId: state.trackId,
        })
        .catch(() => notify("本机保存失败，当前播放不受影响。"));
    }, 250);
    return () => clearTimeout(timer);
  }, [
    ready,
    tracks,
    catalogIds,
    playlists,
    queue,
    mode,
    state.volume,
    state.trackId,
  ]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => notify(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(()=>{
    if(!ready)return;let live=true,running=false;
    const refresh=()=>{if(document.visibilityState==='hidden'||running)return;running=true;void loadBundledLibrary(tracks).then(fresh=>{if(!live||!fresh)return;setTracks(old=>{const merged=mergeBundled(old,fresh,catalogIds).tracks;return JSON.stringify(old)===JSON.stringify(merged)?old:merged;});setCatalogIds(old=>{const next=[...new Set([...old,...fresh.map(track=>track.id)])];return next.length===old.length?old:next;});}).finally(()=>{running=false;});};
    const timer=window.setInterval(refresh,60000);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[ready,catalogIds,tracks]);
  function updateTrack(id: string, patch: Partial<Track>) {
    setTracks((old) => old.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function play(track: Track, newQueue?: string[], remember = true) {
    if (!available(track)) {
      notify("请重新导入此本地文件，收藏和歌词会继续保留。");
      return;
    }
    if (remember && state.trackId && state.trackId !== track.id)
      history.current.push(state.trackId);
    if (newQueue) setQueue(newQueue);
    else if (!queue.includes(track.id)) setQueue((old) => [...old, track.id]);
    updateTrack(track.id, { lastPlayed: Date.now() });
    void player.play(track);
  }
  function seek(time: number) {
    if (!current || !Number.isFinite(time)) return;
    if (!available(current)) {
      notify("请先重新导入此本地文件。");
      return;
    }
    if (player.hasSource()) player.seek(time);
    else {
      if (!queue.includes(current.id)) setQueue((old) => [...old, current.id]);
      void player.play(
        current,
        Math.max(0, current.duration ? Math.min(time, current.duration) : time),
      );
    }
  }
  function next(ended = false) {
    const id = nextId(ids, state.trackId, mode, ended);
    const track = tracks.find((t) => t.id === id);
    if (track) play(track);
  }
  function previous() {
    let id = history.current.pop();
    while (id && !tracks.some((t) => t.id === id && available(t)))
      id = history.current.pop();
    if (!id)
      id =
        ids[
          (Math.max(0, ids.indexOf(state.trackId ?? "")) - 1 + ids.length) %
            ids.length
        ];
    const track = tracks.find((t) => t.id === id);
    if (track) play(track, undefined, false);
  }
  function toggle() {
    if (current) {
      if (state.status === "error" || !player.hasSource()) play(current);
      else void player.toggle();
    } else {
      const first =
        tracks.find((t) => t.id === ids[0]) ?? tracks.find(available);
      if (first)
        play(
          first,
          ids.length ? ids : tracks.filter(available).map((t) => t.id),
        );
      else notify("请先导入音乐或添加音频链接。");
    }
  }
  useEffect(() => {
    player.onEnded = () => next(true);
    return () => {
      player.onEnded = undefined;
    };
  });
  useEffect(() => {
    if (state.trackId && state.duration > 0) {
      setTracks((old) =>
        old.map((t) =>
          t.id === state.trackId && t.duration !== state.duration
            ? { ...t, duration: state.duration }
            : t,
        ),
      );
    }
  }, [state.trackId, state.duration]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        el.closest("input,textarea,button,select,dialog") ||
        el.isContentEditable ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
      if (e.shiftKey && e.code === "ArrowRight") {
        e.preventDefault();
        next();
      }
      if (e.shiftKey && e.code === "ArrowLeft") {
        e.preventDefault();
        previous();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  async function importFiles(files: FileList | File[]) {
    if (importLock.current) {
      notify("正在读取音乐，请稍候。");
      return;
    }
    importLock.current = true;
    setImporting(true);
    const added: Track[] = [];
    const replaced = new Set<string>();
    let skipped = 0, unsavedFiles = 0;
    try {
      for (const file of Array.from(files)) {
        if (
          !file.type.startsWith("audio/") &&
          !/\.(mp3|wav|ogg|m4a|aac|flac|opus|aiff|webm)$/i.test(file.name)
        ) {
          skipped++;
          continue;
        }
        const fallback = file.name.replace(/\.[^.]+$/, "");
        const existing = tracks.find(
          (t) =>
            t.source.kind === "local" &&
            !replaced.has(t.id) &&
            ((t.source.fileName === file.name &&
              t.source.size === file.size &&
              t.source.modified === file.lastModified) ||
              (!t.source.fileName && t.title === fallback && !available(t))),
        );
        const id = existing?.id ?? crypto.randomUUID();
        const fileKey =
          existing?.source.kind === "local" ? existing.source.fileKey : id;
        registerFile(fileKey, file);
        try { await saveLocalFile(fileKey,file); } catch { unsavedFiles++; }
        const metadata = await readMetadata(file);
        replaced.add(id);
        added.push({
          ...existing,
          id,
          title: metadata.title || existing?.title || fallback,
          artist: metadata.artist || existing?.artist || "未知歌手",
          album: metadata.album || existing?.album || "未知专辑",
          cover: metadata.cover || existing?.cover,
          duration: metadata.duration || existing?.duration,
          source: {
            kind: "local",
            fileKey,
            fileName: file.name,
            size: file.size,
            modified: file.lastModified,
          },
          addedAt: existing?.addedAt ?? Date.now(),
          favorite: existing?.favorite ?? false,
          persist: true,
        });
      }
      setTracks((old) => [...old.filter((t) => !replaced.has(t.id)), ...added]);
      notify(
        added.length
          ? `已导入 ${added.length} 首音乐${skipped ? `，跳过 ${skipped} 个非音频文件` : ""}${unsavedFiles ? "；部分文件未能保存在浏览器，下次需重新导入" : ""}`
          : "请选择 MP3、WAV、FLAC 等音频文件。",
      );
    } finally {
      setImporting(false);
      importLock.current = false;
    }
  }
  function favorite(id: string) {
    setTracks((old) =>
      old.map((t) => (t.id === id ? { ...t, favorite: !t.favorite, persist: t.origin?.kind === "resource" ? (!t.favorite || playlists.some(list=>list.trackIds.includes(id))) : true } : t)),
    );
  }
  function removeFromQueue(id: string) {
    if (id === state.trackId) {
      const position = ids.indexOf(id);
      const following = tracks.find((t) => t.id === ids[position + 1]);
      if (following) play(following);
      else player.stop();
    }
    setQueue((old) => old.filter((v) => v !== id));
  }
  function removeTrack(id: string) {
    removeFromQueue(id);
    const track = tracks.find((t) => t.id === id);
    if (track?.source.kind === "local") { forgetFile(track.source.fileKey); void removeLocalFile(track.source.fileKey).catch(()=>{}); }
    setTracks((old) => old.filter((t) => t.id !== id));
    setPlaylists((old) =>
      old.map((p) => ({ ...p, trackIds: p.trackIds.filter((v) => v !== id) })),
    );
  }
  function playNext(track: Track) {
    if (!available(track)) {
      notify("请先重新导入此本地文件。");
      return;
    }
    if (!current) {
      play(track, [track.id]);
      return;
    }
    setQueue((old) => insertNext(old, state.trackId, track.id));
    notify(`已添加到下一首：${track.title}`);
  }
  function addRemote(
    url: string,
    title: string,
    persist: boolean,
    artist?: string,
  ) {
    const track: Track = {
      id: crypto.randomUUID(),
      title,
      artist: artist || new URL(url).hostname,
      album: "远端音频",
      source: { kind: "remote", url },
      addedAt: Date.now(),
      favorite: false,
      persist,
    };
    setTracks((old) => [...old, track]);
    notify("音频链接已添加到音乐库");
  }
  function playResource(input: ResourcePlayback) {
    const origin={...input.origin,resolvedAt:Date.now()};
    const id="resource:"+JSON.stringify([origin.packageId,origin.sourceId,origin.itemUrl]);
    const existing=tracks.find(track=>track.id===id || (track.origin?.kind==='resource'&&track.origin.packageId===origin.packageId&&track.origin.sourceId===origin.sourceId&&track.origin.itemUrl===origin.itemUrl));
    const track:Track={...existing,id:existing?.id||id,title:existing?.title||input.title,artist:existing?.artist||input.artist,album:existing?.album||input.album,
      cover:existing?.cover||input.cover,source:{kind:'remote',url:input.url},origin,addedAt:existing?.addedAt||Date.now(),favorite:existing?.favorite||false,persist:existing?.persist||false,
      lyricText:input.lyricText||existing?.lyricText,lyrics:input.lyricText?parseLrc(input.lyricText):existing?.lyrics,subtitles:input.subtitles||existing?.subtitles};
    setTracks(old=>[...old.filter(item=>item.id!==track.id),track]);setQueue([track.id]);void player.play(track);
  }
  const pruneResourceTracks=useCallback((activeKeys:string[])=>{
    const active=new Set(activeKeys),missing=tracks.filter(track=>track.origin?.kind==='resource'&&!track.persist&&!active.has(track.origin.packageId+"/"+track.origin.sourceId));
    if(!missing.length)return;const ids=new Set(missing.map(track=>track.id));
    if(state.trackId&&ids.has(state.trackId))player.stop();
    setTracks(old=>old.filter(track=>!ids.has(track.id)));setQueue(old=>old.filter(id=>!ids.has(id)));
  },[tracks,state.trackId]);
  function addPlaylist(name: string) {
    const id = crypto.randomUUID();
    setPlaylists((old) => [...old, { id, name, trackIds: [] }]);
    return id;
  }
  function addToPlaylist(playlistId: string, trackId: string) {
    setTracks(old=>old.map(track=>track.id===trackId?{...track,persist:true}:track));
    setPlaylists((old) =>
      old.map((p) =>
        p.id === playlistId
          ? { ...p, trackIds: [...new Set([...p.trackIds, trackId])] }
          : p,
      ),
    );
    notify("已加入歌单");
  }
  function removePlaylistTrack(playlistId: string, trackId: string) {
    setTracks(old=>old.map(track=>track.id===trackId && track.origin?.kind==='resource' && !track.favorite && !playlists.some(list=>list.id!==playlistId&&list.trackIds.includes(trackId))?{...track,persist:false}:track));
    setPlaylists((old) =>
      old.map((p) =>
        p.id === playlistId
          ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) }
          : p,
      ),
    );
    notify("已从歌单移除");
  }
  function clearQueue() {
    setQueue([]);
    player.stop();
  }
  function removeAlbum(album:string) {
    const removed=tracks.filter(track=>libraryTrack(track)&&track.album===album);
    const ids=new Set(removed.map(track=>track.id));
    if(state.trackId&&ids.has(state.trackId))player.stop();
    for(const track of removed)if(track.source.kind==='local'){forgetFile(track.source.fileKey);void removeLocalFile(track.source.fileKey).catch(()=>{});}
    setTracks(old=>old.filter(track=>!ids.has(track.id)));
    setQueue(old=>old.filter(id=>!ids.has(id)));
    setPlaylists(old=>old.map(list=>({...list,trackIds:list.trackIds.filter(id=>!ids.has(id))})));
    notify(`已移除专辑「${album}」`);
  }
  function removePlaylist(playlistId:string) {
    setPlaylists(old=>old.filter(list=>list.id!==playlistId));
    setTracks(old=>old.map(track=>track.origin?.kind==='resource'&&!track.favorite&&!playlists.some(list=>list.id!==playlistId&&list.trackIds.includes(track.id))?{...track,persist:false}:track));
    notify('已移除歌单');
  }
  return {
    playResource,
    pruneResourceTracks,
    playbackTracks: tracks,
    tracks: tracks.filter(libraryTrack),
    playlists,
    queue: ids,
    mode,
    setMode,
    ready,
    importing,
    toast,
    notify,
    state,
    current,
    play,
    next,
    previous,
    toggle,
    importFiles,
    favorite,
    removeTrack,
    removeFromQueue,
    playNext,
    addRemote,
    addPlaylist,
    addToPlaylist,
    removePlaylistTrack,
    clearQueue,
    removeAlbum,
    removePlaylist,
    updateTrack,
    seek,
  };
}
export type MusicController = ReturnType<typeof useMusic>;
