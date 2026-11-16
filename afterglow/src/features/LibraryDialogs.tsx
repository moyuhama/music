import { useEffect, useRef, useState } from "react";
import { X, Music2 } from "lucide-react";
import type { Track } from "../domain/types";
import { validateUrl } from "../sources";
export function PlaylistDialog({
  onClose,
  onCreate,
}: {
  onClose(): void;
  onCreate(name: string): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog className="form-dialog" ref={ref} onCancel={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = String(new FormData(e.currentTarget).get("name")).trim();
          if (name) onCreate(name);
        }}
      >
        <div className="dialog-title">
          <h2>
            <Music2 size={20} />
            新建歌单
          </h2>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <label>
          歌单名称
          <input
            name="name"
            autoFocus
            required
            maxLength={60}
            placeholder="给喜欢的音乐一个名字"
          />
        </label>
        <p>歌单保存在当前浏览器中。</p>
        <button className="primary dialog-submit">创建歌单</button>
      </form>
    </dialog>
  );
}
export function EditTrackDialog({
  track,
  onClose,
  onSave,
}: {
  track: Track;
  onClose(): void;
  onSave(patch: Partial<Track>): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog className="form-dialog" ref={ref} onCancel={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const title = String(data.get("title")).trim();
          if (!title) return;
          try {
            onSave({
              title,
              artist: String(data.get("artist")).trim() || "未知歌手",
              album: String(data.get("album")).trim() || "未知专辑",
              ...(track.source.kind === "remote"
                ? {
                    source: {
                      kind: "remote",
                      url: validateUrl(String(data.get("url"))),
                    },
                  }
                : {}),
            });
          } catch {
            setError("请输入有效的 HTTP 或 HTTPS 音频直链");
          }
        }}
      >
        <div className="dialog-title">
          <h2>编辑歌曲信息</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="关闭"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <label>
          歌曲名称
          <input
            autoFocus
            name="title"
            defaultValue={track.title}
            required
            maxLength={150}
          />
        </label>
        <label>
          歌手
          <input name="artist" defaultValue={track.artist} maxLength={150} />
        </label>
        <label>
          专辑
          <input name="album" defaultValue={track.album} maxLength={150} />
        </label>
        {track.source.kind === "remote" && (
          <label>
            音频直链
            <input
              name="url"
              type="url"
              defaultValue={track.source.url}
              required
            />
            <small>链接修改后，下次播放生效。</small>
          </label>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary dialog-submit">保存修改</button>
      </form>
    </dialog>
  );
}
