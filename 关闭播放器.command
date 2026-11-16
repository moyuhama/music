#!/bin/zsh -l
cd "${0:A:h}/afterglow" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
node scripts/service.mjs stop
printf '\n按回车键关闭此窗口…'
read -r
