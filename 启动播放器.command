#!/bin/zsh -l
cd "${0:A:h}/afterglow" || exit 1
if /bin/zsh scripts/launch.sh; then
  echo "\n启动完成，可以关闭此终端窗口。"
else
  echo "\n启动失败，请查看上方提示。"
fi
printf '\n按回车键关闭此窗口…'
read -r
