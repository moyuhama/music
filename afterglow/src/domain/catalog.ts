import type { Track } from "./types";
export const musicCatalog: Track[] = [
  {
    id: "scott-buckley-undertow",
    title: "Undertow",
    artist: "Scott Buckley",
    album: "Creative Commons Music Library",
    source: {
      kind: "remote",
      url: "https://www.scottbuckley.com.au/library/wp-content/uploads/2019/12/sb_undertow.mp3",
    },
    addedAt: 1,
    favorite: false,
    persist: true,
    attribution: {
      sourceUrl: "https://www.scottbuckley.com.au/library/undertow/",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
  {
    id: "scott-buckley-hiraeth",
    title: "Hiraeth",
    artist: "Scott Buckley",
    album: "Creative Commons Music Library",
    source: {
      kind: "remote",
      url: "https://www.scottbuckley.com.au/library/wp-content/uploads/2020/06/sb_hiraeth.mp3",
    },
    addedAt: 2,
    favorite: false,
    persist: true,
    attribution: {
      sourceUrl: "https://www.scottbuckley.com.au/library/hiraeth/",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
  {
    id: "scott-buckley-solace",
    title: "Solace",
    artist: "Scott Buckley",
    album: "Creative Commons Music Library",
    source: {
      kind: "remote",
      url: "https://www.scottbuckley.com.au/library/wp-content/uploads/2020/05/sb_solace.mp3",
    },
    addedAt: 3,
    favorite: false,
    persist: true,
    attribution: {
      sourceUrl: "https://www.scottbuckley.com.au/library/solace/",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
];
export function mergeCatalog(tracks: Track[], knownIds: string[]) {
  const result = [...tracks];
  for (const item of musicCatalog) {
    if (knownIds.includes(item.id)) continue;
    const match = result.findIndex(
      (t) =>
        t.id === item.id ||
        (t.source.kind === "remote" &&
          item.source.kind === "remote" &&
          t.source.url === item.source.url),
    );
    if (match >= 0) {
      result[match] = {
        ...result[match],
        artist: item.artist,
        album: item.album,
        attribution: item.attribution,
      };
    } else result.push({ ...item, addedAt: Date.now() + item.addedAt });
  }
  return {
    tracks: result,
    catalogIds: [...new Set([...knownIds, ...musicCatalog.map((t) => t.id)])],
  };
}
