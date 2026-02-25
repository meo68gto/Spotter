#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"

echo "==> Spotter launch (web + iOS simulator + Android emulator browser)"

if ! command -v xcrun >/dev/null 2>&1; then
  echo "WARN: Xcode command line tools not found. iOS launch will fail."
fi

if ! command -v adb >/dev/null 2>&1; then
  if [[ -d "$HOME/Library/Android/sdk/platform-tools" ]]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
    export PATH="$ANDROID_HOME/platform-tools:$PATH"
  fi
fi

if ! command -v adb >/dev/null 2>&1; then
  cat <<'EOF'
WARN: Android SDK/adb not detected.
Install Android Studio, then ensure:
  export ANDROID_HOME=$HOME/Library/Android/sdk
  export PATH=$ANDROID_HOME/platform-tools:$PATH
EOF
fi

cd "$MOBILE_DIR"
EXPO_NO_DOCTOR=1 EXPO_NO_DEPENDENCY_VALIDATION=1 /Users/brucewayne/homebrew/opt/node@22/bin/node node_modules/expo/bin/cli start --web --clear --port 8081 &
EXPO_PID=$!

for _ in {1..30}; do
  if curl -sf http://127.0.0.1:8081 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "==> Opening web"
open "http://127.0.0.1:8081" >/dev/null 2>&1 || true

if command -v xcrun >/dev/null 2>&1; then
  BOOTED_UDID="$(xcrun simctl list devices | awk '/Booted/ && /iPhone/ {gsub(/[()]/, "", $NF); print $NF; exit}')"
  if [[ -z "${BOOTED_UDID}" ]]; then
    xcrun simctl boot "iPhone 16e" >/dev/null 2>&1 || true
    open -a Simulator >/dev/null 2>&1 || true
    sleep 2
    BOOTED_UDID="$(xcrun simctl list devices | awk '/Booted/ && /iPhone/ {gsub(/[()]/, "", $NF); print $NF; exit}')"
  fi
  if [[ -n "${BOOTED_UDID}" ]]; then
    echo "==> Opening iOS simulator web view"
    xcrun simctl openurl "$BOOTED_UDID" "http://127.0.0.1:8081" >/dev/null 2>&1 || true
  fi
fi

if command -v adb >/dev/null 2>&1; then
  if adb devices | awk 'NR>1 && $2=="device"{found=1} END{exit found?0:1}'; then
    echo "==> Opening Android emulator web view"
    adb shell am start -a android.intent.action.VIEW -d "http://10.0.2.2:8081" >/dev/null 2>&1 || true
  fi
fi

echo "==> Spotter web preview is running (PID: $EXPO_PID)"
echo "Press Ctrl+C to stop."
wait "$EXPO_PID"
