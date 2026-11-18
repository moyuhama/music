import {useRetainedCover} from "./interactions/useRetainedCover";
import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Compass,
  Settings,
  Heart,
  Link2,
  Plus,
  Search,
  Play,
  Upload,
  Music2,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  ListMusic,
  Grid2X2,
  ArrowDownUp,
  Check,
  X,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import type { Track, View } from "./domain/types";
import { available } from "./sources";
import { player } from "./player/engine";
import { useMusic } from "./features/useMusic";
import Cover from "./components/Cover";
import RemoteDialog from "./features/RemoteDialog";
import PlayerBar from "./features/PlayerBar";
import { useScrollMemory } from "./interactions/useScrollMemory";
import MobileNavigation from "./features/MobileNavigation";
import NowPlaying from "./features/NowPlaying";
import ListeningModes from "./features/ListeningModes";
import {CreateAlbumDialog,ImportAlbumDialog} from "./features/AlbumDialogs";
import ResourceSettings from "./features/ResourceSettings";
import ResourceDiscovery from "./features/ResourceDiscovery";
import { useResources } from "./resources/useResources";
import { useCoverPalette } from "./features/useCoverPalette";
import TrackList from "./features/TrackList";
import QueuePanel from "./features/QueuePanel";
import { PlaylistDialog, EditTrackDialog } from "./features/LibraryDialogs";
const viewNames = {
  settings: "设置",
  discovery: "发现",
  modes: "听歌模式",
  favorites: "我喜欢的音乐",
  local: "本地音乐",
  remote: "远端音频",
  recent: "最近播放",
};
export default function App() {
  const m = useMusic();
  const resources = useResources();
  const visualCover = useRetainedCover(m.current?.cover);
  const palette = useCoverPalette(visualCover);
  useEffect(()=>{if(resources.ready)m.pruneResourceTracks(resources.packages.flatMap(pkg=>pkg.sources.map(source=>pkg.id+"/"+source.id)));},[resources.ready,resources.packages,m.pruneResourceTracks]);
  const [view, setView] = useState<View>("modes");
  useEffect(() => {
    if (resources.ready && !resources.hasSources && view === "discovery") setView("settings");
  }, [resources.ready, resources.hasSources, view]);
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"songs" | "albums">("songs");
  const [albumFilter, setAlbumFilter] = useState("");
  const [sort, setSort] = useState("added");
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [createAlbumOpen,setCreateAlbumOpen]=useState(false);
  const [filesToImport,setFilesToImport]=useState<File[]|null>(null);
  const [albumToImport,setAlbumToImport]=useState<string|undefined>();
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
    setDetailOpen(expanded);
    updateLibrary?.();
  }
  const input = useRef<HTMLInputElement>(null);
  const directoryInput = useRef<HTMLInputElement>(null);
  const playlist = view.startsWith("playlist:")
    ? m.playlists.find((p) => p.id === view.slice(9))
    : undefined;
  const title =
    albumFilter || playlist?.name || viewNames[view as keyof typeof viewNames] || "听歌模式";
  const selected = m.tracks.filter(
    (t) =>
      (view !== "favorites" || t.favorite) &&
      (view !== "local" || t.source.kind === "local" || (t.origin?.kind === "bundled" && !t.origin.hosted)) &&
      (view !== "remote" || (t.source.kind === "remote" && !(t.origin?.kind === "bundled" && !t.origin.hosted))) &&
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
  const importClick = () => {setAlbumToImport(undefined);input.current?.click();};
  const importIntoAlbum=(name:string)=>{setAlbumToImport(name);input.current?.click();};
  function stageImport(files:FileList|File[],album?:string){
    const audio=Array.from(files).filter(file=>file.type.startsWith('audio/')||/\.(mp3|wav|ogg|m4a|aac|flac|opus|aiff|webm)$/i.test(file.name));
    if(!audio.length){m.notify('请选择音频文件');return;}
    setAlbumToImport(album);setFilesToImport(audio);
  }
  const importAlbums=[...new Set([...m.tracks.map(track=>track.album).filter((name):name is string=>!!name&&name!=='未知专辑'),...m.albums.map(album=>album.name)])].map(name=>{
    const metadata=m.albums.find(album=>album.name===name),track=m.tracks.find(track=>track.album===name);
    return {name,artist:metadata?.artist||track?.artist,cover:metadata?.cover||track?.cover};
  });
  function changeView(value: View) {
    setPlayerView(false, () => {
      setView(value);
      setAlbumFilter("");
      setQuery("");
      setLayout("songs");
    });
  }
  const [controlsHost, setControlsHost] = useState<HTMLDivElement | null>(null);
  const [desktopControlsHost, setDesktopControlsHost] = useState<HTMLDivElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(() => matchMedia("(min-width: 821px)").matches);
  useEffect(() => {
    const media = matchMedia("(min-width: 821px)");
    const update = () => setIsDesktop(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <div
      className={`app soda-app ${detailOpen ? "detail-is-open is-listening" : ""}`}
      data-view={detailOpen ? "player" : view}
      style={
        {
          "--listening-cover": visualCover ? `url("${visualCover}")` : "none",
          "--cover-top": palette.top, "--cover-bottom": palette.bottom,
          "--cover-panel": palette.panel, "--cover-bar": palette.bar,
        } as React.CSSProperties
      }
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
          stageImport(e.dataTransfer.files);
      }}
    >
      <div className="listening-ambience" aria-hidden="true" />
      <input
        ref={input}
        hidden
        type="file"
        accept="audio/*,.flac,.m4a,.opus,.aiff"
        multiple
        onChange={(e) => {
          if (e.target.files) stageImport(e.target.files,albumToImport);
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
          if (e.target.files) stageImport(e.target.files,albumToImport);
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
            <span>正在播放</span>
          </button>
          {(["discovery", "modes", "favorites", "settings"] as const).filter((v) => v !== "discovery" || resources.hasSources).map(
            (v) => {
              const Icon = v === "modes" || v === "discovery" ? Compass : v === "settings" ? Settings : Heart;
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
          {detailOpen && (
            <div className="listening-toolbar">
              <div className="listening-window-actions">
                <button className="listening-back" onClick={() => setPlayerView(false)} aria-label="返回音乐库" title="返回音乐库"><ChevronLeft size={20} strokeWidth={1.7} /></button>

              </div>
              <button className="listening-queue" aria-label="查看播放队列" onClick={() => setQueueOpen(true)}>
                <ListMusic size={21} strokeWidth={1.7} />
              </button>
            </div>
          )}
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
              hasResources={resources.hasSources}
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
            {view === "settings" ? <ResourceSettings resources={resources} onDiscover={() => changeView("discovery")} />
            : view === "discovery" ? <ResourceDiscovery packages={resources.packages} onPlay={m.playResource} />
            : view === "modes" ? <ListeningModes
              music={m}
              onCreateAlbum={()=>setCreateAlbumOpen(true)}
              onOpenAlbum={(album) => {
                const albumTracks=m.tracks.filter(track=>track.album===album);
                if(!albumTracks.length){importIntoAlbum(album);return;}
                const tracks=m.tracks.filter(track=>track.album===album&&available(track));
                if(!tracks.length){m.notify("这张专辑暂无可播放的歌曲，请重新导入文件或更新音源。");return;}
                m.play(tracks[0],tracks.map(track=>track.id));
                setQueueOpen(false);
              }}
              onOpenPlaylist={(id) => changeView(`playlist:${id}`)}
            /> : <section className="content">
              <div
                className="collection-header section-enter"
                key={`header-${view}-${albumFilter}`}
              >
                <div className="collection-copy">
                  <h1>{title}</h1>
                  <p className="library-summary">
                    {albumFilter ? `${filtered.length} 首歌曲 · 专辑` : `${selected.length} 首歌曲 · ${new Set(selected.map((t) => t.album || "未知专辑")).size} 张专辑`}
                  </p>
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
              <footer className="library-footer">
                <span>
                  <ShieldCheck size={13} />
                  本地文件仅在浏览器读取，不会上传
                </span>
                <span>支持 MP3 / FLAC / WAV / M4A 等格式</span>
              </footer>
            </section>}
          </div>
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
              onImport={importClick}
              onRemote={() => setRemoteOpen(true)}
              onControlsHost={setControlsHost}
            />
          </div>
      </main>
      <div className="listening-desktop-controls" ref={setDesktopControlsHost} />
      <PlayerBar
        music={m}
        listeningHost={detailOpen ? (isDesktop ? desktopControlsHost : controlsHost) : null}
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
      {createAlbumOpen&&<CreateAlbumDialog onClose={()=>setCreateAlbumOpen(false)} onCreate={info=>{m.createAlbum(info);setCreateAlbumOpen(false);}}/>}
      {filesToImport&&<ImportAlbumDialog files={filesToImport} albums={importAlbums} initialAlbum={albumToImport} onClose={()=>setFilesToImport(null)} onImport={async(info,create)=>{if(create)m.createAlbum(info);await m.importFiles(filesToImport,info);setFilesToImport(null);}}/>}
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
