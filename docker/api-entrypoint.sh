#!/bin/sh
set -eu
# 若宿主机没有 .env，bind mount 会变成目录；进程侧也会跳过，这里只提示。
if [ -d /app/.env ]; then
  echo "warning: /app/.env is a directory (likely a Docker bind mount of a missing file); ignoring"
fi
if [ -d /app/.env.local ]; then
  echo "warning: /app/.env.local is a directory (likely a Docker bind mount of a missing file); ignoring"
fi
exec "$@"
