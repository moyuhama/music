import {createPortal} from "react-dom";
import {resourceMediaUrl} from "../resources/media";
import { useDownloads } from "../downloads/Downloads";
import { publicResourceUrl } from "../resources/policy";
import type { DownloadAsset, DownloadItem } from "../downloads/files";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Download, ArrowLeft, Search, Compass, Disc3, Play, ExternalLink, ChevronDown, RefreshCw, List, Grid2X2, LockKeyhole } from "lucide-react";
import { runResource } from "../resources/client";
import { resourceReference } from "../resources/policy";
import type { ResourceBook, ResourceDetail, ResourceEpisode, ResourceMenu, ResourcePackage, ResourcePage, ResourceSource } from "../resources/types";

function http(value: unknown, base?: string) {
  if (typeof value !== "string" || !value) return "";
  try { const url = new URL(value, base); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
export interface ResourcePlayback { origin: {kind:"resource";packageId:string;sourceId:string;itemUrl:string}; lyricText?:string;subtitles?:ResourceEpisode["subtitles"]; url: string; title: string; artist: string; album: string; cover?: string }
export default function ResourceDiscovery({ packages, onPlay }: { packages: ResourcePackage[]; onPlay(track: ResourcePlayback): void }) {
  const downloads = useDownloads();
  const [selecting,setSelecting] = useState(false);
  const [checked,setChecked] = useState<Set<string>>(new Set());
  const entries = packages.flatMap((pkg) => pkg.sources.map((source) => ({ pkg, source, key: pkg.id + "/" + source.id })));
  const [selected, setSelected] = useState(() => {
    try { const saved = localStorage.getItem("afterglow-resource-source"); return entries.some((item) => item.key === saved) ? saved! : ""; } catch { return ""; }
  });
  const entry = entries.find((item) => item.key === selected);
  const [menus, setMenus] = useState<ResourceMenu[]>([]);
  const [books, setBooks] = useState<ResourceBook[]>([]);
  const [page, setPage] = useState<ResourcePage>({ books: [] });
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState("");
  const [activeTab, setActiveTab] = useState("");
  const [menuIndex, setMenuIndex] = useState(0);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [fullDetail, setFullDetail] = useState(false);
  const [book, setBook] = useState<ResourceBook | null>(null);
  const [detail, setDetail] = useState<ResourceDetail | null>(null);
  const [busy, setBusy] = useState("");
  const [resolvingUrl,setResolvingUrl] = useState("");
  const resolvingAudio = busy === "正在解析音频…";
  const [error, setError] = useState("");
  const [audioError,setAudioError] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const retry = useRef<() => void>(() => {});
  useEffect(() => () => pending.current?.abort(), []);
  function begin(label: string) {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setBusy(label); setError(""); setAudioError(false); return controller;
  }
  async function operation<T>(label: string, work: (signal: AbortSignal) => Promise<T>, apply: (value: T) => void) {
    retry.current = () => { void operation(label, work, apply); };
    const controller = begin(label);
    try { const value = await work(controller.signal); if (!controller.signal.aborted) apply(value); }
    catch (e) { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "音源加载失败"); setAudioError(label === "正在解析音频…"); } }
    finally { if (!controller.signal.aborted) setBusy(""); }
  }
  function showPage(result: ResourcePage, source: ResourceSource) {
    if (!result || !Array.isArray(result.books)) throw new Error("音源返回的列表格式无效");
    setBooks(result.books.slice(0, 300).filter((item) => typeof item.title === "string" && resourceReference(item.bookUrl, source.url)).map((item) => ({
      title: item.title, bookUrl: resourceReference(item.bookUrl, source.url), coverUrl: http(item.coverUrl, source.url),
      artist: typeof item.artist === "string" ? item.artist : "", intro: typeof item.intro === "string" ? item.intro : "",
    })));
    setPage(result); setBook(null); setDetail(null);
  }
  const identity = entry ? entry.key + ":" + entry.pkg.importedAt : "";
  useEffect(() => {
    setMenus([]); setBooks([]); setPage({books:[]}); setBook(null); setDetail(null); setQuery(""); setSearching(""); setActiveTab(""); setError(""); setMenuIndex(0);
    pending.current?.abort(); setBusy("");
    if (!entry) return;
    try { localStorage.setItem("afterglow-resource-source", entry.key); } catch {}
    const { pkg, source } = entry;
    void operation("正在加载音源…", async (signal) => {
      const result = await runResource<ResourceMenu[]>(pkg, "categoryMenus", source.id, [], signal);
      return Array.isArray(result) ? result.filter((menu) => typeof menu.title === "string" && Array.isArray(menu.tabs)).map((menu) => ({
        title: menu.title, tabs: menu.tabs.filter((tab) => typeof tab.title === "string" && resourceReference(tab.url, source.url)).map((tab) => ({ title: tab.title, url: resourceReference(tab.url, source.url) })),
      })) : [];
    }, (result) => {
      setMenus(result);
      const first = result[0]?.tabs[0];
      if (first) browse(first.url);
    });
  }, [identity, reloadVersion]);
  function browse(url: string) {
    if (!entry) return;
    setSearching(""); setActiveTab(url); setPage({books:[]}); setBooks([]);
    void operation("正在加载内容…", (signal) => runResource<ResourcePage>(entry.pkg, "categoryPage", entry.source.id, [url], signal), (result) => showPage(result, entry.source));
  }
  function search(text: string, number = 1) {
    if (!entry || !text.trim()) return;
    setSearching(text.trim()); setActiveTab(""); setPage({books:[]}); setBooks([]);
    void operation("正在搜索…", (signal) => runResource<ResourcePage>(entry.pkg, "search", entry.source.id, [text.trim(), number], signal), (result) => showPage({ ...result, currentPage: result.currentPage || number }, entry.source));
  }
  function openBook(item: ResourceBook, full = false) {
    if (!entry) return;
    setBook(item); if (!full) { setDetail(null); setSelecting(false); setChecked(new Set()); }
    void operation(full ? "正在加载完整目录…" : "正在加载目录…", (signal) => runResource<ResourceDetail>(entry.pkg, "bookDetail", entry.source.id, [item.bookUrl, true, full], signal), (result) => {
      if (!result || !Array.isArray(result.episodes)) throw new Error("音源没有返回有效目录");
      setFullDetail(full);
      setBook({ ...item, title: typeof result.title === "string" && result.title ? result.title : item.title,
        artist: typeof result.artist === "string" && result.artist ? result.artist : item.artist,
        coverUrl: http(result.coverUrl, entry.source.url) || item.coverUrl,
        intro: typeof result.intro === "string" ? result.intro.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200) : item.intro });
      setDetail({ episodes: result.episodes.slice(0, 3000).filter((episode) => typeof episode.title === "string" && resourceReference(episode.url, entry.source.url)).map((episode) => ({ title: episode.title, url: resourceReference(episode.url, entry.source.url), isFree: typeof episode.isFree === "boolean" ? episode.isFree : undefined, lyricText: typeof episode.lyricText === "string" ? episode.lyricText : undefined, subtitles: Array.isArray(episode.subtitles) ? episode.subtitles.filter(item => typeof item.text === "string" && ["lrc","srt","vtt","txt"].includes(item.format)) : undefined })) });
    });
  }
  function playEpisode(episode: ResourceEpisode) {
    if (!entry || !book) return;
    setResolvingUrl(episode.url);
    void operation("正在解析音频…", (signal) => runResource<string | { url: string; headers?: Record<string, string> }>(entry.pkg, "audio", entry.source.id, [episode.url], signal), (result) => {
      const audio = typeof result === "string" ? { url: result } : result;
      const url = http(audio?.url, entry.source.url);
      if (!url) throw new Error("音源没有返回可播放的音频地址");
      if (location.protocol === "https:" && url.startsWith("http:")) throw new Error("此音频仅提供 HTTP 地址，HTTPS 网页无法播放，请打开来源网站收听");
      onPlay({ url: resourceMediaUrl(url, "headers" in audio ? audio.headers : undefined), title: episode.title === "直播" ? book.title : episode.title, artist: book.artist || entry.source.name, album: book.title, cover: book.coverUrl, origin:{kind:"resource",packageId:entry.pkg.id,sourceId:entry.source.id,itemUrl:episode.url},lyricText:(audio as DownloadAsset).lyricText||episode.lyricText,subtitles:(audio as DownloadAsset).subtitles||episode.subtitles });
    });
  }
  function episodeDownload(episode: ResourceEpisode): DownloadItem {
    const current = entry!;
    return {id:episode.url,title:episode.title,async resolve(signal) {
      const result = await runResource<string | (DownloadAsset & {headers?:Record<string,string>})>(current.pkg,"audio",current.source.id,[episode.url],signal);
      const audio = typeof result === "string" ? {url:result} : result;
      return {...audio,url:publicResourceUrl(audio.url),lyricText:audio.lyricText || episode.lyricText,subtitles:[...(audio.subtitles || []),...(episode.subtitles || [])]};
    }};
  }
  function back() {
    pending.current?.abort(); setBusy(""); setError("");
    if (book) { setBook(null); setDetail(null); } else setSelected("");
  }
  function refresh() {
    if (book) openBook(book, fullDetail);
    else if (searching) search(searching, page.currentPage || 1);
    else if (activeTab) browse(activeTab);
    else setReloadVersion((value) => value + 1);
  }
  function chooseMenu(index: number) {
    setMenuIndex(index);
    const first = menus[index]?.tabs[0];
    if (first) browse(first.url);
  }
  const sourceOptions = <select aria-label="选择音源" value={selected} onChange={(e) => setSelected(e.target.value)}>
    <option value="">全部音源</option>
    {packages.map((pkg) => <optgroup label={pkg.name} key={pkg.id}>{pkg.sources.map((source) => <option value={pkg.id + "/" + source.id} key={source.id}>{source.name}</option>)}</optgroup>)}
  </select>;
  return <section className="content discovery-page">
    <header className="discovery-heading">
      <div className="discovery-title">{entry && <button className="icon-button" onClick={back} aria-label={book ? "返回内容列表" : "返回全部音源"}><ArrowLeft size={19} /></button>}
        <div className="resource-source-picker"><h1>{book?.title || entry?.source.name || "发现"}</h1>{!book && <><ChevronDown size={16} />{sourceOptions}</>}</div>
      </div>
      {entry && !book && <div className="discovery-header-tools">
        <form className="resource-search" onSubmit={(e) => { e.preventDefault(); search(query); }}><Search size={15} /><input aria-label="搜索当前音源" placeholder="在这个源里搜索" value={query} onChange={(e) => setQuery(e.target.value)} /><button aria-label="搜索" disabled={!!busy || !query.trim()}>搜索</button></form>
        <button className="icon-button" onClick={() => setLayout(layout === "grid" ? "list" : "grid")} aria-label={layout === "grid" ? "切换列表视图" : "切换封面视图"}>{layout === "grid" ? <List size={19} /> : <Grid2X2 size={19} />}</button>
        <button className="icon-button" onClick={refresh} disabled={!!busy} aria-label="刷新内容"><RefreshCw size={18} /></button>
      </div>}
    </header>
    {!entry ? <div className="resource-source-grid">{entries.map(({ source, key }) => <button className="resource-source-card" key={key} onClick={() => setSelected(key)}>
      <Compass size={25} /><strong>{source.name}</strong><small>{source.group || "音源"}</small><span>{new URL(source.url).hostname}</span>
    </button>)}</div> : <>
      {!book && menus.length > 0 && <>
        <div className="resource-channels" role="tablist" aria-label="音源频道">{menus.map((menu, i) => <button role="tab" aria-selected={menuIndex === i} key={menu.title + i} onClick={() => chooseMenu(i)}>{menu.title}</button>)}</div>
        <div className="resource-filters" aria-label="分类筛选">{menus[menuIndex]?.tabs.map((tab, j) => <button key={tab.url + j} aria-pressed={activeTab === tab.url} onClick={() => browse(tab.url)}>{tab.title}</button>)}</div>
      </>}
      {book && <section className="resource-album-summary" aria-label="专辑信息"><div className="resource-book-cover">{book.coverUrl ? <img src={book.coverUrl} alt="" referrerPolicy="no-referrer" /> : <Disc3 size={36} />}</div><div><span>{entry.source.name}</span><strong>{book.artist || entry.source.name}</strong>{book.intro && <p>{book.intro}</p>}</div></section>}
      {busy && (resolvingAudio ? createPortal(<div className="resource-loading is-audio" role="status"><span>{busy}</span><button onClick={() => { pending.current?.abort(); setBusy(""); }}>取消</button></div>,document.body) : <div className="resource-loading" role="status"><span>{busy}</span><button onClick={() => { pending.current?.abort(); setBusy(""); }}>取消</button></div>)}
      {error && (audioError ? createPortal(<div className="resource-error-box is-audio" role="alert"><p>{error}</p><div><button onClick={() => retry.current()}>重试</button><button onClick={()=>setError("")}>关闭</button><a href={http(book?.bookUrl) || http(entry.source.url)} target="_blank" rel="noreferrer">打开来源网站<ExternalLink size={14}/></a></div></div>,document.body) : <div className="resource-error-box" role="alert"><p>{error}</p><div><button onClick={() => retry.current()}>重试</button><a href={http(book?.bookUrl) || http(entry.source.url)} target="_blank" rel="noreferrer">打开来源网站<ExternalLink size={14}/></a></div></div>)}
      {!book && <div className={"resource-book-grid " + (layout === "list" ? "is-list" : "")}>{books.map((item, i) => <button className="resource-book-card" key={item.bookUrl + i} onClick={() => openBook(item)}>
        <span className="resource-book-cover">{item.coverUrl ? <img src={item.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Disc3 size={44} />}</span><strong>{item.title}</strong><small>{item.artist}</small>
      </button>)}</div>}
      {!book && !busy && !error && !books.length && <p className="resource-empty">{searching ? "没有找到相关内容" : "选择分类或搜索内容"}</p>}
      {!book && !busy && !error && searching && <div className="resource-pagination">
        {(page.currentPage || 1) > 1 && <button className="secondary" onClick={() => search(searching, (page.currentPage || 1) - 1)}>上一页</button>}
        {(page.totalPage || 1) > (page.currentPage || 1) && <button className="secondary" onClick={() => search(searching, (page.currentPage || 1) + 1)}>下一页</button>}
      </div>}
      {!book && !busy && !error && !searching && resourceReference(page.nextUrl, entry.source.url) && <button className="secondary" onClick={() => browse(resourceReference(page.nextUrl, entry.source.url))}>下一页</button>}
      {book && detail && <div className="resource-episodes">
        <div className="resource-directory-heading"><p>已加载 {detail.episodes.length} 集</p><div className="resource-directory-actions">
          {entry.source.multipleEpisodePages && !fullDetail && <button className="secondary" disabled={!!busy} onClick={() => openBook(book, true)}>加载完整目录</button>}
          <button className="secondary" onClick={()=>{setSelecting(!selecting);setChecked(new Set());}}>{selecting ? "退出多选" : "批量下载"}</button>
        </div></div>
        {selecting && <div className="batch-download-toolbar"><label><input type="checkbox" aria-label="全选当前章节" checked={!!detail.episodes.filter(e=>e.isFree!==false).length && detail.episodes.filter(e=>e.isFree!==false).every(e=>checked.has(e.url))} onChange={e=>setChecked(e.target.checked?new Set(detail.episodes.filter(e=>e.isFree!==false).map(e=>e.url)):new Set())}/>全选已加载章节</label><button className="secondary" disabled={downloads.busy || !checked.size} onClick={()=>downloads.start(detail.episodes.filter(e=>checked.has(e.url) && e.isFree!==false).map(episodeDownload),book.title)}><Download size={15}/>下载所选（{checked.size}）</button></div>}
        {detail.episodes.map((episode,i)=><div className="resource-episode" key={episode.url+i}>
          {selecting && <input type="checkbox" aria-label={`选择章节 ${episode.title}`} disabled={episode.isFree===false} checked={checked.has(episode.url)} onChange={e=>setChecked(old=>{const next=new Set(old);e.target.checked?next.add(episode.url):next.delete(episode.url);return next;})}/>}
          <button className="resource-episode-play" disabled={(!!busy && !resolvingAudio) || episode.isFree===false} aria-busy={resolvingAudio && resolvingUrl===episode.url} onClick={()=>playEpisode(episode)}><span>{String(i+1).padStart(2,"0")}</span><strong>{episode.title}</strong>{episode.isFree===false?<><small>需来源授权</small><LockKeyhole size={15}/></>: resolvingAudio && resolvingUrl===episode.url ? <LoaderCircle size={16} className="spin"/> : <Play size={16}/>}</button>
          {!selecting && <button className="icon-button" aria-label={`下载 ${episode.title}`} disabled={downloads.busy || episode.isFree===false} onClick={()=>downloads.start([episodeDownload(episode)],episode.title)}><Download size={16}/></button>}
        </div>)}
        {!detail.episodes.length && <p className="resource-empty">这个专辑还没有可播放内容</p>}
      </div>}

    </>}
  </section>;
}
