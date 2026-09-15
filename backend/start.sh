#!/usr/bin/env bash
# Start the Unison backend and print the LAN IP for the app to point at.
set -euo pipefail
cd "$(dirname "$0")"

IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")

echo
echo "  Unison backend"
if [ -n "$IP" ]; then
  echo "  Give this to the app:  EXPO_PUBLIC_API_URL=http://$IP:8000"
else
  echo "  Could not detect a LAN IP - are you on wifi?"
fi
echo "  Local:                 http://localhost:8000"
echo "  Phone and laptop must be on the same network."
echo

if [ ! -f songs.json ]; then
  echo "  WARNING: no songs.json - run: .venv/bin/python prep_songs.py"
  echo
fi

# Use "python -m" so a renamed project folder cannot break the shebang
exec .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000
