#!/usr/bin/env sh
# Serves HashLab on http://localhost:8000 (loopback only).
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8000}"

if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 was not found. Install it, or serve this folder with any static web server." >&2
    exit 1
fi

echo "HashLab is running at http://localhost:$PORT (press Ctrl+C to stop)"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
