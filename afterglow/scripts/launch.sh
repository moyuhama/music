#!/bin/zsh
set -e
PROJECT_DIR="${0:A:h:h}"
cd "$PROJECT_DIR"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "没有找到 Node.js，请先安装 Node.js 20.19+（或 22.12+）。"
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "没有找到 npm，请检查 Node.js 安装。"
  exit 1
fi
if [[ ! -d node_modules ]]; then
  echo "首次启动：安装项目依赖，请保持网络连接…"
  npm ci --no-audit --no-fund
fi
echo "正在准备播放器…"
npm run build
node scripts/service.mjs start
