# 音乐播放器架构与扩展约定

## 目标和边界

第一版在浏览器内完成本地和远端音频播放，以单一播放内核统一两类音源。扩展通过明确的模块接口完成，不提前引入后端、微服务或动态插件运行时。

本地文件无需上传。远端播放会连接用户提供的服务器。播放支持取决于浏览器可解码的音频格式和源站访问策略；音频直链与网页分享链接应在产品提示中区分。

## 工程布局

实际实现以 src 目录为准：features/useMusic.ts 负责应用状态编排，player、sources、storage、domain 分别独立；下面为持续扩展时的功能分组约定。

```text
src/
  app/                 应用装配、页面布局和初始化
  domain/              Track、Playlist、Queue 等类型和纯逻辑
  player/              单一音频实例、播放状态与浏览器媒体事件
  sources/             音源接口、本地文件和远端直链适配器
  storage/             IndexedDB、数据迁移和仓储接口
  features/
    library/           导入、搜索、收藏和音乐列表
    queue/             队列界面及队列操作
    now-playing/       播放控制与当前曲目展示
    settings/          偏好设置
  components/          通用按钮、对话框和提示
  styles/              颜色、间距、排版和响应式样式
tests/                 核心逻辑测试与浏览器流程测试
docs/                  架构、迭代计划及后续决策记录
```

## 模块职责和数据流

界面操作 → 应用状态 → 音源解析 → 播放内核 → 音频事件 → 界面状态。

| 模块 | 负责 | 不负责 |
| --- | --- | --- |
| domain | 曲目模型、队列顺序、播放模式规则 | DOM、网络访问、组件渲染 |
| sources | 将曲目来源解析成可播放地址，释放资源 | 决定播放顺序和修改页面 |
| player | 播放控制、事件订阅、状态转换 | 歌单管理和数据库读写 |
| storage | 保存、查询、删除和版本迁移 | 发起播放 |
| features | 将用户操作映射为模块调用，展示状态 | 直接创建新的音频实例 |

整个应用仅有一个活动音频实例。当前时间等高频信息仅更新订阅它的播放区域，避免整张音乐库随进度刷新。

## 数据模型

```ts
type SourceRef =
  | { kind: 'local'; fileKey: string }
  | { kind: 'remote'; url: string };

interface Track {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  source: SourceRef;
  addedAt: number;
}

interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

interface QueueState {
  trackIds: string[];
  currentTrackId: string | null;
  mode: 'sequence' | 'repeat-one' | 'shuffle';
  history: string[];
}
```

收藏单独保存曲目 ID 集合，播放状态单独维护，不把是否正在播放写进 Track。曲目使用稳定 ID，不用标题或数组下标当身份。未知时长保留为空，不伪造为零秒；实时流不可 seek 时禁用进度拖动。

第一版本地 fileKey 只关联当前会话的 File。刷新后允许保留元数据，但必须标记为需要重新选择文件，不能将失效的 blob 地址恢复为可播放曲目。

## 音源接口

```ts
interface ResolvedSource {
  url: string;
  release(): void;
}

interface SourceProvider {
  kind: SourceRef['kind'];
  resolve(track: Track, signal: AbortSignal): Promise<ResolvedSource>;
}
```

本地适配器使用对象 URL，并在不再使用、删除曲目或销毁播放器时释放。远端适配器验证协议，直接把音频地址交给播放内核；不把带查询参数的地址当作日志输出，也不向其追加应用凭据。

快速切歌时取消上一次解析，并用请求标识忽略过期结果。失败展示在当前曲目上，保留可重试入口，避免自动连续重试。未来新增授权音源时扩展 SourceRef 和对应适配器，界面继续调用相同播放入口。

## 播放与队列

播放器状态包括 idle、loading、playing、paused、ended 和 error。状态以真实媒体事件为准，并处理 play() 被拒绝的情况。播放加载后不表示已开始播放。

播放模式与音频实例解耦，单独实现 next、previous 和 ended 的队列规则。手动下一首不受单曲循环限制。随机模式保留历史，使上一首有确定行为。删除当前曲目时，若有后续曲目则选择后续曲目；否则停止并清空当前项。清空队列必须停止播放并释放资源。

## 本机存储

第一版使用 IndexedDB 保存曲目元数据、收藏和播放偏好，通过 TrackRepository、FavoritesRepository 和 SettingsRepository 访问。文件与对象 URL 不进入持久化数据。队列可恢复，播放位置可保存，但刷新后等待用户操作再播放。

数据库显式记录版本，迁移通过 storage 模块完成。写入失败或配额不可用时提示用户并继续提供会话内播放。用户可删除单条记录或清空本机数据。带临时凭据的远端地址默认仅在会话中使用；明确选择“保存链接”后才写入本机数据库，并提示同一浏览器资料中的可见性与过期风险。

## 后续扩展位置

| 需求 | 接入位置 | 触发时机 |
| --- | --- | --- |
| 标签、内嵌封面、时长解析 | library 的导入流程 | 基础播放稳定后 |
| LRC 歌词与滚动同步 | 新增 lyrics 功能，订阅播放时间 | 第二阶段 |
| 更多音源、短期授权链接 | sources，必要时新增服务端解析端点 | 确定具体服务及授权方式后 |
| 登录和跨设备同步 | 新增 API 与远端仓储，实现冲突策略 | 用户明确需要同步后 |
| 均衡器与频谱 | player 的音频处理层 | 处理远端跨域和性能要求后 |
| PWA 与本地文件持久保存 | 应用壳与 storage | 明确离线范围和存储上限后 |

本机数据不会因为未来添加账号而自动上传。上线云同步前需明确同步字段、授权和退出账号后的数据处理方式。

## 质量要求

- 用户输入按文本展示，协议白名单仅允许 HTTP/HTTPS；对象 URL 由本地模块生成。
- HTTPS 页面遇到 HTTP 音源，提示可能的浏览器拦截，建议使用 HTTPS 源，不自动绕过。
- 远端源站防盗链、鉴权、过期链接或不支持媒体范围请求时，提供可理解的失败或拖动受限提示，不承诺万能代理。
- 控件提供可访问名称、键盘焦点和可读对比度；输入框内不触发播放快捷键。
- 单元测试覆盖队列模式、当前曲目删除、数据迁移和过期解析结果；浏览器验证本地与远端的真实播放流程。
- 浏览器测试使用仓库自带的短音频夹具和本地测试源，不依赖长期可用的外部演示地址。
