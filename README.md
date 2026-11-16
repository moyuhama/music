# 余音音乐播放器

简约白色的网页音乐播放器，支持本地文件、远端音频直链、同步 LRC 歌词、收藏、歌单和播放队列。

**在线使用：https://moyuhama.github.io/music/**

## 本机使用

macOS 双击 `启动播放器.command` 启动并打开播放器，双击 `关闭播放器.command` 关闭服务。首次使用需要安装 Node.js 与 npm。

## 开发

```sh
cd afterglow
npm ci
npm run dev
npm test
npm run build
```

## 部署

推送到 `main` 后，GitHub Actions 自动安装依赖、运行测试、构建并部署到 GitHub Pages。也可在 Actions 页面手动执行 Deploy to GitHub Pages。

项目位于 `afterglow/`。本地文件在浏览器内读取，不会上传到仓库或服务器；个人音乐库数据保存在当前浏览器中，线上与本机地址的数据互相独立。

[完整使用说明](afterglow/README.md) · [架构约定](afterglow/docs/architecture.md) · [音乐来源与署名](afterglow/docs/music-sources.md)
