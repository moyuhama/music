import { useEffect, useRef, useState } from "react";
import { X, Link2, ArrowUpRight } from "lucide-react";
import { validateUrl } from "../sources";
export default function RemoteDialog({
  onClose,
  onAdd,
}: {
  onClose(): void;
  onAdd(url: string, title: string, persist: boolean): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="remote-dialog"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          try {
            const url = validateUrl(String(form.get("url")));
            onAdd(
              url,
              String(form.get("title")).trim(),
              form.get("persist") === "on",
            );
          } catch {
            setError("请输入有效的 HTTP 或 HTTPS 音频地址");
          }
        }}
      >
        <div className="dialog-heading">
          <div className="dialog-icon">
            <Link2 size={22} />
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <h2>添加远端音频</h2>
        <p>支持 HTTP / HTTPS 音频直链，例如 MP3、WAV、M4A。</p>
        <label>
          音频地址
          <input
            autoFocus
            name="url"
            type="url"
            placeholder="https://example.com/music.mp3"
            required
          />
        </label>
        <label>
          歌曲名称 <span>可选</span>
          <input
            name="title"
            placeholder="给这段声音起个名字"
            maxLength={150}
          />
        </label>
        <label className="checkbox-label">
          <input name="persist" type="checkbox" />
          保存链接，下次继续听
        </label>
        <p className="fine-print">
          仅保存在当前浏览器。含访问令牌的链接也会被保存，请按需选择。音乐平台分享页不能直接播放；源站需允许浏览器访问。
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary dialog-submit" type="submit">
          加入音乐库 <ArrowUpRight size={17} />
        </button>
      </form>
    </dialog>
  );
}
