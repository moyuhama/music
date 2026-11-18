import type { Track, PlayMode, Playlist } from "../domain/types";
export interface SavedState {
  tracks: Track[];
  catalogIds?: string[];
  volume: number;
  mode: PlayMode;
  playlists?: Playlist[];
  queue?: string[];
  currentId?: string | null;
}
let pending: Promise<IDBDatabase> | undefined;
function database() {
  return (pending ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("afterglow", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("state");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("数据库被其他页面占用"));
  }));
}
export const libraryRepository = {
  async load(): Promise<SavedState | undefined> {
    const db = await database();
    return new Promise((resolve, reject) => {
      const req = db.transaction("state").objectStore("state").get("library");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async save(value: SavedState) {
    const db = await database();
    const tracks = value.tracks.filter(
      (t) => t.source.kind === "local" || t.persist,
    );
    const savedIds = new Set(tracks.map((t) => t.id));
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("state", "readwrite");
      tx.objectStore("state").put(
        {
          ...value,
          tracks,
          currentId: value.currentId && savedIds.has(value.currentId) ? value.currentId : null,
          queue: value.queue?.filter((id) => savedIds.has(id)),
          playlists: value.playlists?.map((p) => ({
            ...p,
            trackIds: p.trackIds.filter((id) => savedIds.has(id)),
          })),
        },
        "library",
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  },
};
