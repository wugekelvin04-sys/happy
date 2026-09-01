#!/usr/bin/env bash
# 在本机启动一个静态服务器，供 iPhone 通过局域网访问并「添加到主屏幕」
set -e
PORT="${1:-8080}"
DIR="$(cd "$(dirname "$0")" && pwd)"
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)
echo "三合棋牌 已启动"
echo "  本机： http://localhost:$PORT/"
echo "  iPhone（同一 Wi-Fi）： http://$IP:$PORT/"
echo "  在 iPhone 的 Safari 打开上面的地址 → 分享 → 添加到主屏幕"
echo "按 Ctrl+C 停止"
cd "$DIR"
exec python3 -m http.server "$PORT" --bind 0.0.0.0
