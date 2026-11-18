import {diskDownloadHref,localDownloads,createDiskDownload,addDiskItem,finishDiskDownload,diskStatus,removeDiskDownload,saveDiskDownload} from "./disk";
import { createContext, useContext, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { DownloadZip, readAudio, safeName, saveBlob, sidecars, type DownloadItem } from "./files";
const Context = createContext<{ start(items: DownloadItem[], name?: string): void; busy: boolean }>({start() {},busy:false});
export const useDownloads = () => useContext(Context);
export function Downloads({children}: {children: React.ReactNode}) {
  const active = useRef<AbortController | null>(null);
  const [state,setState] = useState<{title:string; count:number; total:number; done:boolean; failures:string[]; successes:number; disk?:boolean; bytes?:number; packing?:boolean; downloadId?:string} | null>(null);
  async function start(input: DownloadItem[], name = "音乐下载") {
    if (active.current || !input.length) return;
    const items = [...new Map(input.map((item) => [item.id,item])).values()];
    const controller = new AbortController(); active.current = controller;
    const zip = new DownloadZip(); const failures: string[] = [];
    let successes = 0, bytes = 0, zipped = false;
    let diskId: string | undefined, poll: ReturnType<typeof setInterval> | undefined;
    const disk=localDownloads();
    const reportBytes=()=>{if(diskId)void diskStatus(diskId).then(value=>setState(old=>old && !old.done && active.current === controller ? {...old,bytes:value.bytes}:old)).catch(()=>{});};
    setState({title:"准备下载",count:0,total:items.length,done:false,failures:[],successes:0,disk,bytes:0});
    try {
      if(disk){diskId=(await createDiskDownload(name,items.length>1,controller.signal)).id;poll=setInterval(reportBytes,700);}
      for (let i=0;i<items.length;i++) {
        const item = items[i]; controller.signal.throwIfAborted();
        setState({title:item.title,count:i,total:items.length,done:false,failures:[...failures],successes,disk,bytes});
        let asset;
        try {
          asset = await item.resolve(controller.signal);
          if(diskId){const saved=await addDiskItem(diskId,i,item.title,asset,controller.signal);successes++;bytes+=saved.bytes;continue;}
          const {blob,extension,size} = await readAudio(asset, controller.signal);
          controller.signal.throwIfAborted();
          const extras = sidecars(asset);
          const extraSize = extras.reduce((sum, extra) => sum + new TextEncoder().encode(extra.text).byteLength, 0);
          if (bytes + size + extraSize > 256 * 1024 * 1024) {
            failures.push(...items.slice(i).map((entry) => entry.title + "：下载包超过 256 MB，请分批选择")); break;
          }
          const base = safeName(item.title);
          if (items.length === 1 && !extras.length) saveBlob(blob, base + "." + extension);
          else {
            const unique = items.length > 1 ? String(i+1).padStart(3,"0") + " " + base : base;
            zipped = true;
            zip.add(unique + "." + extension, new Uint8Array(await blob.arrayBuffer()));
            const counts = new Map<string,number>();
            extras.forEach((extra) => {
              const count = (counts.get(extra.format) || 0) + 1; counts.set(extra.format,count);
              zip.text(unique + (count > 1 ? `.${count}` : "") + "." + extra.format, extra.text);
            });
          }
          bytes += size + extraSize; successes++;
        } catch(error) {
          if (controller.signal.aborted) throw error;
          failures.push(item.title + "：" + (error instanceof TypeError ? "音频网站不允许网页下载，或网络连接失败" : error instanceof Error ? error.message : "下载失败"));
        } finally { asset?.release?.(); }
      }
      if(diskId && successes){
        setState({title:"正在打包文件…",count:items.length,total:items.length,done:false,failures:[...failures],successes,disk,bytes,packing:true});
        bytes=(await finishDiskDownload(diskId,failures,controller.signal)).bytes;zip.cancel();controller.signal.throwIfAborted();saveDiskDownload(diskId);
      } else if (successes && zipped) {
        if (failures.length) zip.text("下载失败清单.txt", failures.join("\n"));
        saveBlob(zip.finish(), safeName(name) + ".zip");
      } else zip.cancel();
      setState({title:successes ? "已交给浏览器保存" : "下载未完成",count:items.length,total:items.length,done:true,failures:[...failures],successes,disk,bytes,downloadId:successes?diskId:undefined});
      if(diskId && !successes)await removeDiskDownload(diskId).catch(()=>{});
    } catch(error) { if(diskId)await removeDiskDownload(diskId).catch(()=>{}); zip.cancel(); setState({title:controller.signal.aborted ? "已取消下载" : "下载失败",count:0,total:items.length,done:true,failures:controller.signal.aborted ? [] : [String(error)],successes:0}); }
    finally { if(poll)clearInterval(poll); active.current=null; }
  }
  // Each download receives a fresh queue; no background downloads after cancellation.
  return <Context.Provider value={{start,busy:!!state && !state.done}}>{children}{state && <aside className="download-panel" aria-label="下载任务">
    <header><strong><Download size={16}/> {state.done ? state.title : state.packing ? "正在打包" : `下载中 ${state.count+1} / ${state.total}`}</strong><button aria-label={state.done ? "关闭下载结果" : "取消下载"} onClick={() => { if (active.current) active.current.abort(); else setState(null); }}><X size={17}/></button></header>
    {!state.done && <><p>{state.title}</p><progress value={state.count} max={state.total}/><small>{state.disk ? `本地服务流式保存，已读取 ${((state.bytes||0)/1024/1024).toFixed(1)} MB；无批次大小上限。` : "纯网页模式使用内存打包，每批最多 256 MB。"}</small></>}
    {state.done && <p role="status">成功 {state.successes} 项{state.failures.length ? `，失败 ${state.failures.length} 项` : ""}</p>}
    {state.done && state.downloadId && <a className="download-save-link" href={diskDownloadHref(state.downloadId)} download>保存文件</a>}
    {!!state.failures.length && <details><summary>查看失败原因（{state.failures.length}）</summary><ul>{state.failures.map((text,i)=><li key={i}>{text}</li>)}</ul></details>}
  </aside>}</Context.Provider>;
}
