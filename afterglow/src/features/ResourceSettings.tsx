import { useRef } from "react";
import { Archive, Upload, Trash2, Compass } from "lucide-react";
import type { ResourcesController } from "../resources/useResources";
export default function ResourceSettings({ resources: r, onDiscover }: { resources: ResourcesController; onDiscover(): void }) {
  const input = useRef<HTMLInputElement>(null);
  return <section className="content settings-page">
    <h1>设置</h1>
    <section className="resource-settings" aria-labelledby="resource-import-title">
      <header><div><h2 id="resource-import-title">导入资源 ZIP</h2><p>导入音源后，可在“发现”中浏览内容。资源包仅保存在当前浏览器。</p></div><Archive size={24} /></header>
      <input type="file" accept=".zip,application/zip,application/x-zip-compressed" hidden ref={input} aria-label="资源 ZIP 文件" onChange={(e) => {
        const file = e.target.files?.[0]; e.target.value = ""; if (file) void r.importZip(file);
      }} />
      <div className="resource-import-actions">
        <button className="primary" disabled={!r.ready || r.busy} onClick={() => input.current?.click()}><Upload size={16} />{r.busy ? "正在导入…" : "导入资源 ZIP"}</button>
        {r.hasSources && <button className="secondary" onClick={onDiscover}><Compass size={16} />前往发现</button>}
      </div>
      {r.error && <p className="resource-error" role="alert">{r.error}</p>}
      {r.message && <p className="resource-success" role="status">{r.message}</p>}
      <div className="resource-packages" aria-label="已导入资源包">
        {r.packages.map((pkg) => <article className="resource-package" key={pkg.id}>
          <Archive size={22} /><div><strong>{pkg.name}</strong><small>v{pkg.version} · {pkg.sources.length} 个音源{pkg.author ? " · " + pkg.author : ""}</small></div>
          <button className="icon-button" aria-label={"移除资源包 " + pkg.name} disabled={r.busy} onClick={() => void r.remove(pkg.id)}><Trash2 size={17} /></button>
        </article>)}
        {r.ready && !r.packages.length && <p className="resource-empty">尚未导入资源包</p>}
      </div>
      <p className="resource-note">部分音源接口禁止网页跨域访问，或需要网站验证、专用请求头，导入成功不代表所有音源都能在网页版播放。</p>
    </section>
  </section>;
}
