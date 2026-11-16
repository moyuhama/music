import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Library,
  Heart,
  Link2,
  Plus,
  Search,
  Play,
  Upload,
  Music2,
  Clock3,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  ListMusic,
  Grid2X2,
  ArrowDownUp,
  Check,
  X,
  LoaderCircle,
  Headphones,
  ShieldCheck,
} from "lucide-react";
import type { Track, View } from "./domain/types";
import { available } from "./sources";
import { player } from "./player/engine";
import { useMusic } from "./features/useMusic";
import Cover from "./components/Cover";
import RemoteDialog from "./features/RemoteDialog";
import PlayerBar from "./features/PlayerBar";
import {
  transitionPlayer,
  cancelPlayerTransition,
} from "./interactions/playerTransition";
import { useScrollMemory } from "./interactions/useScrollMemory";
import MobileNavigation from "./features/MobileNavigation";
import NowPlaying from "./features/NowPlaying";
import TrackList from "./features/TrackList";
import QueuePanel from "./features/QueuePanel";
import { PlaylistDialog, EditTrackDialog } from "./features/LibraryDialogs";
const viewNames = {
  all: "全部音乐",
  favorites: "我喜欢的音乐",
  local: "本地音乐",
  remote: "远端音频",
  recent: "最近播放",
};
export default function App() {
  const m = useMusic();
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"songs" | "albums">("songs");
  const [albumFilter, setAlbumFilter] = useState("");
  const [sort, setSort] = useState("added");
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(true);
  const [queueOpen, setQueueOpen] = useState(false);
  const [editTrack, setEditTrack] = useState<Track | null>(null);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const libraryScroll = useScrollMemory(
    JSON.stringify([view, query, layout, albumFilter, sort]),
    !detailOpen,
  );
  function setPlayerView(expanded: boolean, updateLibrary?: () => void) {
    if (expanded === detailOpen) {
      cancelPlayerTransition();
      updateLibrary?.();
      return;
    }
    transitionPlayer(expanded, () => {
      setDetailOpen(expanded);
      updateLibrary?.();
    });
  }
  useEffect(() => () => cancelPlayerTransition(), []);
  const input = useRef<HTMLInputElement>(null);
  const lyricsInput = useRef<HTMLInputElement>(null);
  const lyricTarget = useRef("");
  const directoryInput = useRef<HTMLInputElement>(null);
  const playlist = view.startsWith("playlist:")
    ? m.playlists.find((p) => p.id === view.slice(9))
    : undefined;
  const title =
    playlist?.name ?? viewNames[view as keyof typeof viewNames] ?? "全部音乐";
  const selected = m.tracks.filter(
    (t) =>
      (view !== "favorites" || t.favorite) &&
      (view !== "local" || t.source.kind === "local") &&
      (view !== "remote" || t.source.kind === "remote") &&
      (view !== "recent" || t.lastPlayed) &&
      (!playlist || playlist.trackIds.includes(t.id)),
  );
  const filtered = selected
    .filter(
      (t) =>
        `${t.title} ${t.artist} ${t.album ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (!albumFilter || t.album === albumFilter),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title, "zh-CN")
        : view === "recent"
          ? (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0)
          : b.addedAt - a.addedAt,
    );
  const albums = Array.from(
    new Set(filtered.map((t) => t.album || "未知专辑")),
  ).map((name) => ({
    name,
    tracks: filtered.filter((t) => (t.album || "未知专辑") === name),
  }));
  const importClick = () => input.current?.click();
  const chooseLyrics = (id: string) => {
    lyricTarget.current = id;
    lyricsInput.current?.click();
  };
  function changeView(value: View) {
    setPlayerView(false, () => {
      setView(value);
      setAlbumFilter("");
      setQuery("");
      setLayout("songs");
    });
  }
  const sampleNames = ["晚风来信", "城市慢游", "月光留声"];
  const sampleFiles = ["evening", "city", "moon"];
  return (
    <div
      className={`app ${detailOpen ? "detail-is-open" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes("Files")) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length)
          void m.importFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={input}
        hidden
        type="file"
        accept="audio/*,.flac,.m4a,.opus,.aiff"
        multiple
        onChange={(e) => {
          if (e.target.files) void m.importFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={directoryInput}
        hidden
        type="file"
        multiple
        {...{ webkitdirectory: "" }}
        onChange={(e) => {
          if (e.target.files) void m.importFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={lyricsInput}
        hidden
        type="file"
        accept=".lrc,text/plain"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void m.importLyrics(file, lyricTarget.current);
          e.target.value = "";
        }}
      />
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          aria-label="余音首页"
          onClick={(e) => {
            e.preventDefault();
            setPlayerView(true);
          }}
        >
          <span className="brand-mark">
            <AudioLines size={24} />
          </span>
          <strong>
            余音<span>MUSIC PLAYER</span>
          </strong>
        </a>
        <div className="nav-group-title">我的音乐</div>
        <nav aria-label="音乐库导航">
          <button
            aria-label="播放器首页"
            className={`nav-item ${detailOpen ? "active" : ""}`}
            onClick={() => setPlayerView(true)}
          >
            <AudioLines size={19} />
            <span>播放器</span>
          </button>
          {(["all", "favorites", "recent", "local", "remote"] as const).map(
            (v) => {
              const Icon =
                v === "all"
                  ? Library
                  : v === "favorites"
                    ? Heart
                    : v === "recent"
                      ? Clock3
                      : v === "local"
                        ? FolderOpen
                        : Link2;
              return (
                <button
                  key={v}
                  aria-label={viewNames[v]}
                  className={`nav-item ${!detailOpen && view === v ? "active" : ""}`}
                  onClick={() => changeView(v)}
                >
                  <Icon size={19} strokeWidth={1.8} />
                  <span>{viewNames[v]}</span>
                  {v === "favorites" && (
                    <small>{m.tracks.filter((t) => t.favorite).length}</small>
                  )}
                </button>
              );
            },
          )}
        </nav>
        <div className="nav-group-title playlist-group">
          创建的歌单
          <button aria-label="新建歌单" onClick={() => setPlaylistOpen(true)}>
            <Plus size={16} />
          </button>
        </div>
        <div className="playlist-nav">
          {m.playlists.map((p) => (
            <button
              className={`nav-item ${!detailOpen && playlist?.id === p.id ? "active" : ""}`}
              key={p.id}
              aria-label={`歌单 ${p.name}`}
              onClick={() => changeView(`playlist:${p.id}`)}
            >
              <ListMusic size={18} />
              <span>{p.name}</span>
              <small>{p.trackIds.length}</small>
            </button>
          ))}
          <button
            className="create-playlist"
            aria-label="创建歌单"
            onClick={() => setPlaylistOpen(true)}
          >
            <span>
              <Plus size={16} />
            </span>
            <em>新建一个歌单</em>
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="private-mode">
            <ShieldCheck size={16} />
            <span>
              私人音乐空间<small>本地文件无需上传</small>
            </span>
            <i />
          </div>
          <span className="version">余音 Web · v0.2</span>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <button
            className="mobile-home"
            aria-label="返回播放器首页"
            onClick={() => setPlayerView(true)}
          >
            <AudioLines size={20} />
          </button>
          <div className="top-context">
            <span>
              音乐空间 <i>/</i>{" "}
              <strong
                className="page-label"
                key={detailOpen ? "player" : title}
              >
                {detailOpen ? "正在播放" : title}
              </strong>
            </span>
          </div>
          <label className="search">
            <Search size={16} />
            <input
              aria-label="搜索音乐"
              placeholder="搜索歌曲、歌手、专辑"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPlayerView(false);
              }}
            />
            {query ? (
              <button aria-label="清除搜索" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            ) : (
              <kbd>搜索</kbd>
            )}
          </label>
          <div className="topbar-tools">
            <button
              className="icon-button"
              aria-label="导入音乐文件"
              onClick={importClick}
            >
              <Plus size={19} />
            </button>
            <button
              className="icon-button"
              aria-label="添加音频链接"
              onClick={() => setRemoteOpen(true)}
            >
              <Link2 size={18} />
            </button>
            <MobileNavigation
              view={view}
              isPlayer={detailOpen}
              playlists={m.playlists}
              queueCount={m.queue.length}
              volume={m.state.volume}
              onQueue={() => setQueueOpen(true)}
              onVolume={(value) => player.setVolume(value)}
              onPlayer={() => setPlayerView(true)}
              onView={changeView}
              onCreate={() => setPlaylistOpen(true)}
            />
          </div>
        </header>
        <div className="page-stack">
          <div
            className={`page-layer library-page ${!detailOpen ? "is-active" : ""}`}
            ref={libraryScroll.ref}
            onScroll={libraryScroll.onScroll}
            aria-hidden={detailOpen}
            inert={detailOpen}
          >
            <section className="content">
              <div
                className="collection-header section-enter"
                key={`header-${view}`}
              >
                <div
                  className={`collection-art ${view === "favorites" ? "heart-art" : ""}`}
                >
                  {view === "favorites" ? (
                    <Heart size={60} fill="currentColor" strokeWidth={0} />
                  ) : playlist ? (
                    <ListMusic size={62} strokeWidth={1.2} />
                  ) : view === "local" ? (
                    <FolderOpen size={61} strokeWidth={1.2} />
                  ) : view === "remote" ? (
                    <Link2 size={60} strokeWidth={1.2} />
                  ) : view === "recent" ? (
                    <Clock3 size={60} strokeWidth={1.2} />
                  ) : (
                    <AudioLines size={66} strokeWidth={1.3} />
                  )}
                  <span>
                    {view === "favorites"
                      ? "MY FAVORITES"
                      : playlist
                        ? "MY PLAYLIST"
                        : "MY COLLECTION"}
                  </span>
                  <div className="art-grain" />
                </div>
                <div className="collection-copy">
                  <div className="collection-kicker">
                    <span>{playlist ? "歌单" : "音乐库"}</span>
                    <small>YOUR MUSIC, YOUR WAY</small>
                  </div>
                  <h1>{title}</h1>
                  <p>
                    {view === "favorites"
                      ? "把喜欢的旋律，留在身边"
                      : view === "recent"
                        ? "听过的好音乐，再听一次"
                        : view === "local"
                          ? "来自你的电脑，属于你的收藏"
                          : view === "remote"
                            ? "通过音频直链，连接远方的声音"
                            : playlist
                              ? "用音乐记录每一个时刻"
                              : "你的本地收藏与远端旋律，都在这里"}
                  </p>
                  <div className="collection-meta">
                    <span className="user-avatar">
                      <Headphones size={13} />
                    </span>
                    <strong>我的音乐空间</strong>
                    <span className="meta-dot" />
                    <span>{selected.length} 首歌曲</span>
                    <span className="meta-dot" />
                    <span>
                      {new Set(selected.map((t) => t.album || "未知专辑")).size}{" "}
                      张专辑
                    </span>
                  </div>
                </div>
              </div>
              <div className="action-bar">
                <button
                  className="primary play-all"
                  disabled={!filtered.some(available) || !m.ready}
                  onClick={() => {
                    const list = filtered.filter(available);
                    if (list[0])
                      m.play(
                        list[0],
                        list.map((t) => t.id),
                      );
                  }}
                >
                  <Play size={16} fill="currentColor" />
                  播放全部<span>{filtered.filter(available).length}</span>
                </button>
                <button
                  className="secondary"
                  disabled={m.importing || !m.ready}
                  onClick={importClick}
                >
                  {m.importing ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Plus size={17} />
                  )}
                  <span>{m.importing ? "正在读取…" : "导入音乐"}</span>
                </button>
                <button
                  className="secondary"
                  disabled={!m.ready}
                  onClick={() => setRemoteOpen(true)}
                >
                  <Link2 size={16} />
                  <span>添加链接</span>
                </button>
                <button
                  className="folder-button"
                  title="导入文件夹中的音频"
                  disabled={m.importing || !m.ready}
                  onClick={() => directoryInput.current?.click()}
                >
                  <FolderOpen size={17} />
                  <span>选择文件夹</span>
                </button>
                <div className="library-view-control">
                  <button
                    className={layout === "songs" ? "selected" : ""}
                    aria-label="歌曲列表视图"
                    onClick={() => setLayout("songs")}
                  >
                    <ListMusic size={17} />
                  </button>
                  <button
                    className={layout === "albums" ? "selected" : ""}
                    aria-label="专辑网格视图"
                    onClick={() => setLayout("albums")}
                  >
                    <Grid2X2 size={16} />
                  </button>
                </div>
              </div>
              <div className="library-toolbar">
                <div className="tabs">
                  <button
                    className={layout === "songs" ? "selected" : ""}
                    onClick={() => setLayout("songs")}
                  >
                    歌曲列表 <span>{filtered.length}</span>
                  </button>
                  <button
                    className={layout === "albums" ? "selected" : ""}
                    onClick={() => {
                      setAlbumFilter("");
                      setLayout("albums");
                    }}
                  >
                    专辑 <span>{albums.length}</span>
                  </button>
                  {albumFilter && (
                    <button
                      className="album-filter"
                      onClick={() => setAlbumFilter("")}
                    >
                      {albumFilter}
                      <X size={12} />
                    </button>
                  )}
                </div>
                <label className="sort-control">
                  <ArrowDownUp size={13} />
                  <select
                    aria-label="歌曲排序"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="added">
                      {view === "recent" ? "播放时间" : "添加时间"}
                    </option>
                    <option value="name">歌曲名称</option>
                  </select>
                </label>
              </div>
              <div
                className="library-content-swap section-enter"
                key={`${view}-${layout}-${albumFilter}`}
              >
                {!m.ready ? (
                  <div className="empty">
                    <LoaderCircle size={25} className="spin" />
                    <p>正在加载音乐库</p>
                  </div>
                ) : layout === "songs" ? (
                  <TrackList
                    music={m}
                    tracks={filtered}
                    onImport={importClick}
                    onLyrics={chooseLyrics}
                    onEdit={setEditTrack}
                    onCreatePlaylist={() => setPlaylistOpen(true)}
                    playlistId={playlist?.id}
                    onRemoveFromPlaylist={(id) => {
                      if (playlist) {
                        m.removePlaylistTrack(playlist.id, id);
                      }
                    }}
                  />
                ) : (
                  <div className="album-grid">
                    {albums.length ? (
                      albums.map((album, i) => (
                        <button
                          className="album-card"
                          key={album.name}
                          onClick={() => {
                            setAlbumFilter(
                              album.name === "未知专辑" ? "" : album.name,
                            );
                            setLayout("songs");
                          }}
                        >
                          <div className="album-cover">
                            <Cover
                              large
                              index={i}
                              src={album.tracks[0].cover}
                            />
                            <span>
                              <Play size={21} fill="currentColor" />
                            </span>
                          </div>
                          <strong>{album.name}</strong>
                          <small>
                            {album.tracks.length} 首 · {album.tracks[0].artist}
                          </small>
                        </button>
                      ))
                    ) : (
                      <div className="empty">
                        <Music2 size={30} />
                        <p>导入音乐后，专辑会显示在这里</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!query && !playlist && view === "all" && (
                <section className="sample-section">
                  <div className="section-heading">
                    <h2>试听一下</h2>
                    <span>余音声音实验室 · 原创合成纯音乐</span>
                  </div>
                  <div className="sample-grid">
                    {sampleNames.map((name, i) => (
                      <button
                        className="sample-card"
                        key={name}
                        disabled={!m.ready}
                        onClick={() => m.addSample(i)}
                      >
                        <div className="sample-art">
                          <img
                            src={`${import.meta.env.BASE_URL}covers/${sampleFiles[i]}.svg`}
                            alt=""
                          />
                          <span>
                            <Play size={17} fill="currentColor" />
                          </span>
                        </div>
                        <div>
                          <strong>{name}</strong>
                          <small>
                            {
                              [
                                "Ambient / 温暖、舒缓",
                                "Lo-fi / 松弛、轻盈",
                                "Piano / 安静、入夜",
                              ][i]
                            }
                          </small>
                        </div>
                        <Play className="sample-play" size={16} />
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <footer className="library-footer">
                <span>
                  <ShieldCheck size={13} />
                  本地文件仅在浏览器读取，不会上传
                </span>
                <span>支持 MP3 / FLAC / WAV / M4A 等格式</span>
              </footer>
            </section>
          </div>
          <div
            className={`page-layer player-page ${detailOpen ? "is-active" : ""}`}
            aria-hidden={!detailOpen}
            inert={!detailOpen}
          >
            <NowPlaying
              active={detailOpen}
              music={m}
              onClose={() => setPlayerView(false)}
              onLyrics={chooseLyrics}
              onImport={importClick}
              onRemote={() => setRemoteOpen(true)}
              onSample={() => m.addSample(0)}
            />
          </div>
        </div>
      </main>
      <PlayerBar
        music={m}
        openDetail={() => setPlayerView(true)}
        queueOpen={queueOpen}
        openQueue={() => setQueueOpen(!queueOpen)}
      />
      {queueOpen && (
        <>
          <button
            className="queue-scrim"
            aria-label="收起队列"
            onClick={() => setQueueOpen(false)}
          />
          <QueuePanel music={m} onClose={() => setQueueOpen(false)} />
        </>
      )}
      {remoteOpen && (
        <RemoteDialog
          onClose={() => setRemoteOpen(false)}
          onAdd={(url, title, persist) => {
            let name = title;
            if (!name) {
              try {
                name = decodeURIComponent(
                  new URL(url).pathname.split("/").pop() || "远端音频",
                ).replace(/\.[^.]+$/, "");
              } catch {
                name = "远端音频";
              }
            }
            m.addRemote(url, name || "远端音频", persist);
            setRemoteOpen(false);
            if (location.protocol === "https:" && url.startsWith("http:"))
              m.notify(
                "HTTPS 页面可能无法播放 HTTP 音频，请优先使用 HTTPS 链接。",
              );
          }}
        />
      )}
      {playlistOpen && (
        <PlaylistDialog
          onClose={() => setPlaylistOpen(false)}
          onCreate={(name) => {
            const id = m.addPlaylist(name);
            changeView(`playlist:${id}`);
            setPlaylistOpen(false);
            m.notify("歌单已创建，打开歌曲的更多菜单即可添加");
          }}
        />
      )}
      {editTrack && (
        <EditTrackDialog
          track={editTrack}
          onClose={() => setEditTrack(null)}
          onSave={(patch) => {
            m.updateTrack(editTrack.id, patch);
            setEditTrack(null);
            m.notify("歌曲信息已保存");
          }}
        />
      )}
      {m.state.error && (
        <div className="error-banner" role="alert">
          <span>{m.state.error}</span>
          <button onClick={() => m.current && m.play(m.current)}>重试</button>
          <button aria-label="关闭播放错误" onClick={() => player.stop()}>
            <X size={15} />
          </button>
        </div>
      )}
      {m.toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {m.toast}
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <Upload size={43} />
          <h2>松开以导入音乐</h2>
          <p>支持多首音频同时导入</p>
        </div>
      )}
    </div>
  );
}
