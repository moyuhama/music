# 开源音乐播放器设计调研

调研日期：2026 年 11 月 17 日。对照项目截图、README、许可证及布局、切换、歌词源码，研究适合余音的交互规则。研究材料为下列提交的静态截图和源码，本轮未安装或运行这些项目。

建议以 YesPlayMusic 的白色视觉层级为主参考，以 SPlayer-Next 的封面衔接和布局状态规则为交互参考，借鉴 AMLL 对歌词手动浏览、自动跟随和进度跳转的处理。保留余音的 React、浏览器音频内核和 GitHub Pages 静态部署方式。

## 研究项目与证据

| 项目 | 检查内容 | 适用点 | 当前边界 |
| --- | --- | --- | --- |
| [YesPlayMusic](https://github.com/qier222/YesPlayMusic) | 白色音乐库截图、歌词截图、App.vue、Player.vue、lyrics.vue | 封面与文字的比例、留白、统一导航、播放器持续存在 | 当前版本 README 标注维护模式；完整应用依赖网易云相关服务 |
| [SPlayer](https://github.com/imsyy/SPlayer) | AppLayout.vue、FullPlayerMobile.vue、全屏播放截图 | 小屏专用界面、封面与歌词分页、滑动时跟手、无歌词时限制分页 | API 元数据显示旧仓库已归档，README 指向 SPlayer-Next |
| [SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next) | MainLayout.vue、playerTransition.ts、coverTransition.ts、ClassicLayout.vue、响应式布局 | 共享封面过渡、取消冲突动画、还原列表位置、无歌词封面居中 | 完整应用包含 Electron 与 Rust 原生音频能力，不能整体作为纯静态 Pages 项目使用 |
| [Apple Music-like Lyrics](https://github.com/amll-dev/applemusic-like-lyrics) | 滚动引擎、焦点、跳转判断、弹簧实现、React 文档 | 自动跟随与用户手势分开管理，进度跳转区别处理 | 适合歌词模块研究；引入前需核对发布版本、性能与许可证 |
| [APlayer](https://github.com/DIYgod/APlayer) | 播放器模板、播放器逻辑、歌词逻辑 | 紧凑控制条、折叠播放列表、播放与歌词模块分开 | 是嵌入式播放器组件，不覆盖完整音乐库应用设计 |

## 可直接指导改版的发现

### 1 封面需要在展开与收起之间保持连续

SPlayer-Next 用稳定标识匹配底栏封面和完整播放器封面，并通过 View Transitions 处理位置、尺寸和圆角的衔接。图片未准备好、页面不可见、用户减少动态效果或浏览器不支持时，会回退到普通切换。它还会取消已被新操作取代的过渡，防止快速点击产生冲突。

余音目前以内容层淡入淡出为主。下一轮应给封面建立连续的位置关系，并明确图片未加载、快速切换和减少动态效果时的处理方式。

证据：[playerTransition.ts](https://github.com/SPlayer-Dev/SPlayer-Next/blob/6b26b685f67cfac9d3233747b399255620f45b87/src/services/playerTransition.ts#L77)、[view-transitions.css](https://github.com/SPlayer-Dev/SPlayer-Next/blob/6b26b685f67cfac9d3233747b399255620f45b87/src/styles/view-transitions.css#L33)。

### 2 列表位置属于每个页面的状态

SPlayer-Next 在离开路由时记录内容区滚动位置，并在进入完成后恢复；同时对列表页面做受控缓存。余音当前播放器与音乐库之间保留内容层，但收藏、本地和其他列表共用一个滚动容器，应进一步按页面记录位置。

证据：[MainLayout.vue](https://github.com/SPlayer-Dev/SPlayer-Next/blob/6b26b685f67cfac9d3233747b399255620f45b87/src/layouts/MainLayout.vue#L73)。

### 3 小屏需要独立的内容组织

SPlayer 旧版的 FullPlayerMobile 将封面信息与歌词分成两个可切换页面。手指滑动时页面跟随位移，松手后按方向和阈值决定是否切换；没有歌词时不允许滑入歌词页。这说明小屏的空间分配和交互可以有独立规则。

余音继续遵守已确定的约束：小屏不显示侧栏，音量和队列进入顶部菜单。若采用封面与歌词分页，必须同时提供可点击入口，避免只靠手势发现功能。

证据：[FullPlayerMobile.vue](https://github.com/imsyy/SPlayer/blob/40d9ec606cc1e323c964ffea7bf0ab02f137e93b/src/components/Player/FullPlayerMobile.vue#L187)。

### 4 无歌词应改变布局

YesPlayMusic 用 no-lyric 状态调整封面位置；SPlayer-Next 的 ClassicLayout 根据歌词是否存在、用户是否显示歌词、队列是否打开决定封面居中与歌词可见性。

余音应继续保持：没有歌词就不渲染歌词区域和缺失提示；有歌词时展示歌词；打开队列后保证主要内容仍然清楚，状态变化有衔接。

证据：[YesPlayMusic lyrics.vue](https://github.com/qier222/YesPlayMusic/blob/5d5fa23b7429c82a9932bbc2c9f6036403c5757b/src/views/lyrics.vue#L1111)、[ClassicLayout.vue](https://github.com/SPlayer-Dev/SPlayer-Next/blob/6b26b685f67cfac9d3233747b399255620f45b87/src/components/player/FullPlayer/layouts/standard/ClassicLayout.vue#L13)。

### 5 歌词浏览应尊重用户正在做的操作

AMLL 的滚动引擎识别触摸、滚轮、惯性与交互结束；把暂停自动跟随、允许恢复自动对齐、滚动边界更新分开。跳转检测器将进度倒退或超出正常推进的变化识别为跳转。

余音目前每次当前歌词改变就滚动定位，用户向前浏览时可能被拉回。下一轮优先增加手动浏览状态、恢复到当前句的入口，以及 seek 后立即定位的规则，再考虑逐字效果。

证据：[scroll.ts](https://github.com/amll-dev/applemusic-like-lyrics/blob/832bad5f16ec2a7f96d06707ef927c9a4d3713d3/packages/core/src/lyric-player/base/scroll.ts#L1)、[seek-detector.ts](https://github.com/amll-dev/applemusic-like-lyrics/blob/832bad5f16ec2a7f96d06707ef927c9a4d3713d3/packages/core/src/lyric-player/base/seek-detector.ts#L21)。

## 改版顺序与验收

1. 统一布局与状态：白色主题、封面与歌曲信息层级、无歌词居中、小屏无侧栏。验收宽窄屏及有无歌词两种布局。
2. 连续过渡：封面在迷你栏和播放页之间衔接，列表按页面恢复位置。验收快速往返、图片未加载和减少动态效果。
3. 歌词交互：手动翻阅时暂停跟随，提供回到当前句入口，点击歌词或拖动进度后正确定位。验收暂停、切歌和歌词导入。
4. 控件细节：统一触控目标、菜单位置、队列开关与键盘焦点，保留持续播放的单一音频实例。

## 代码复用边界

仓库许可证核对结果：YesPlayMusic、APlayer 为 MIT；SPlayer、SPlayer-Next、AMLL 为 AGPL-3.0。YesPlayMusic 的 README 还包含用途说明，直接复用前应连同 LICENSE 一起核清。直接引入或改编 AGPL 项目代码时，需要处理相应许可证、源码提供和署名要求。本轮仅记录研究结论，没有向余音复制这些项目的实现。

固定研究版本：

- YesPlayMusic：`5d5fa23b7429c82a9932bbc2c9f6036403c5757b`
- SPlayer：`40d9ec606cc1e323c964ffea7bf0ab02f137e93b`
- SPlayer-Next：`6b26b685f67cfac9d3233747b399255620f45b87`
- AMLL：`832bad5f16ec2a7f96d06707ef927c9a4d3713d3`
- APlayer：`52e9feee9c90022e577dac76ca159e164bb980f0`
