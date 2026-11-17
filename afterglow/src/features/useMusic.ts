import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Track, PlayMode, Playlist } from "../domain/types";
import { nextId, insertNext } from "../domain/types";
import { player } from "../player/engine";
import { libraryRepository } from "../storage";
import { available, registerFile, forgetFile } from "../sources";
import { readMetadata } from "./import-metadata";
import { removeDemoLyrics } from "../domain/lyrics";
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
      .then((saved) => {
        if (!live) return;
        const merged = mergeCatalog(
          (saved?.tracks ?? []).map(removeDemoLyrics),
          saved?.catalogIds ?? [],
        );
        setTracks(merged.tracks);
        setCatalogIds(merged.catalogIds);
        if (saved) {
          setPlaylists(saved.playlists ?? []);
          setQueue(saved.queue ?? []);
          setMode(saved.mode);
          player.setVolume(saved.volume);
          const selected =
            saved.tracks.find((t) => t.id === saved.currentId) ??
            [...saved.tracks]
              .sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0))
              .find(available) ??
            saved.tracks[0];
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
    let skipped = 0;
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
          ? `已导入 ${added.length} 首音乐${skipped ? `，跳过 ${skipped} 个非音频文件` : ""}`
          : "请选择 MP3、WAV、FLAC 等音频文件。",
      );
    } finally {
      setImporting(false);
      importLock.current = false;
    }
  }
  function favorite(id: string) {
    setTracks((old) =>
      old.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)),
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
    if (track?.source.kind === "local") forgetFile(track.source.fileKey);
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
  function playResource(input: { url: string; title: string; artist: string; album: string; cover?: string }) {
    const existing = tracks.find((track) => track.source.kind === "remote" && track.source.url === input.url);
    const track: Track = existing ?? {
      id: crypto.randomUUID(), title: input.title, artist: input.artist, album: input.album,
      cover: input.cover, source: { kind: "remote", url: input.url },
      addedAt: Date.now(), favorite: false, persist: true,
    };
    setTracks((old) => old.some((item) => item.id === track.id) ? old : [...old, track]);
    setQueue([track.id]);
    void player.play(track);
  }
  function addPlaylist(name: string) {
    const id = crypto.randomUUID();
    setPlaylists((old) => [...old, { id, name, trackIds: [] }]);
    return id;
  }
  function addToPlaylist(playlistId: string, trackId: string) {
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
    setPlaylists((old) =>
      old.map((p) =>
        p.id === playlistId
          ? { ...p, trackIds: p.trackIds.filter((id) => id !== trackId) }
          : p,
      ),
    );
    notify("已从歌单移除，歌曲仍保留在音乐库");
  }
  function clearQueue() {
    setQueue([]);
    player.stop();
  }
  function addSample(index: number) {
    const names = ["晚风来信", "城市慢游", "月光留声"];
    const urls = ["evening", "city", "moon"];
    const id = `sample-${urls[index]}`;
    const track: Track = tracks.find((t) => t.id === id) ?? {
      id,
      title: names[index],
      artist: "余音声音实验室",
      album: "片刻之间 · 原创合成试听",
      cover: `${import.meta.env.BASE_URL}covers/${urls[index]}.svg`,
      duration: 24,
      source: {
        kind: "remote",
        url: new URL(
          `${import.meta.env.BASE_URL}samples/${urls[index]}.wav`,
          location.origin,
        ).href,
      },
      addedAt: Date.now(),
      favorite: false,
      persist: true,
    };
    setTracks((old) =>
      old.some((t) => t.id === id)
        ? old.map((t) => (t.id === id ? { ...t, lastPlayed: Date.now() } : t))
        : [...old, { ...track, lastPlayed: Date.now() }],
    );
    void player.play(track);
    setQueue((old) => (old.includes(id) ? old : [...old, id]));
  }
  return {
    playResource,
    tracks,
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
    addSample,
    updateTrack,
    seek,
  };
}
export type MusicController = ReturnType<typeof useMusic>;
