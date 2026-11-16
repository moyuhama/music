# 音乐来源与署名

项目加入以下三首原曲，使用作者官网公开提供的 MP3 音频直链。歌曲未经剪辑或改编，音频保留在作者服务器，播放需要网络连接。

| 曲目 | 作者 | 官方来源 | 授权 |
| --- | --- | --- | --- |
| Undertow | Scott Buckley | https://www.scottbuckley.com.au/library/undertow/ | CC BY 4.0 |
| Hiraeth | Scott Buckley | https://www.scottbuckley.com.au/library/hiraeth/ | CC BY 4.0 |
| Solace | Scott Buckley | https://www.scottbuckley.com.au/library/solace/ | CC BY 4.0 |

三首作品均由 Scott Buckley 发布，按 Creative Commons Attribution 4.0 International License 使用。授权条款：https://creativecommons.org/licenses/by/4.0/ 。播放器展示曲名、作者、官方来源链接和授权链接，不将替代图案标记为原专辑封面，也不为纯音乐生成虚构歌词。

曲目目录位于 `src/domain/catalog.ts`。每个浏览器首次载入时合并新增目录曲目；已有相同地址则补全作者和授权信息。移除歌曲后不会在刷新时自动重新添加。跨浏览器打开也能得到这些目录曲目。
