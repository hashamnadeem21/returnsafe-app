#!/usr/bin/env bash
# Generates Expo Router typed-route declarations (.expo/types/router.d.ts) without a device.
# Expo only writes them while the dev server runs, so start it briefly and stop once the file appears.
set -euo pipefail
cd "$(dirname "$0")/.."
TYPES=.expo/types/router.d.ts
rm -f "$TYPES"
CI=1 npx expo start --port 8099 > /tmp/expo-typegen.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for _ in $(seq 1 90); do
  if [ -s "$TYPES" ] && grep -q "/home" "$TYPES"; then
    echo "Route types generated: $TYPES"
    exit 0
  fi
  sleep 1
done
echo "Timed out generating route types" >&2
cat /tmp/expo-typegen.log >&2
exit 1
