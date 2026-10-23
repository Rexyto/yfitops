#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

APPIMAGETOOL="${APPIMAGETOOL:-appimagetool}"
if ! command -v "$APPIMAGETOOL" >/dev/null 2>&1; then
  printf 'Error: install a recent AppImageKit appimagetool or set APPIMAGETOOL to its path.\n' >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1 || ! command -v zsyncmake >/dev/null 2>&1; then
  printf 'Error: install curl and zsyncmake to build the update-enabled AppImage.\n' >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
APPIMAGE_NAME="YFitops-${VERSION}-x86_64.AppImage"
APPIMAGE_PATH="$PROJECT_DIR/release/$APPIMAGE_NAME"
APPDIR_PATH="$PROJECT_DIR/release/linux-unpacked"
RUNTIME_PATH="${APPIMAGE_RUNTIME:-$PROJECT_DIR/release/.runtime-x86_64}"
UPDATE_INFO="gh-releases-zsync|Rexyto|yfitops|latest|YFitops-*-x86_64.AppImage.zsync"

mkdir -p "$PROJECT_DIR/release"

if [[ -e "$APPIMAGE_PATH" || -e "${APPIMAGE_PATH}.zsync" ]]; then
  printf 'Error: output already exists; move the existing AppImage and .zsync before rebuilding this version.\n' >&2
  exit 1
fi

if [[ -n "${APPIMAGE_RUNTIME:-}" ]]; then
  if [[ ! -s "$RUNTIME_PATH" ]]; then
    printf 'Error: APPIMAGE_RUNTIME does not point to a non-empty runtime file: %s\n' "$RUNTIME_PATH" >&2
    exit 1
  fi
else
  trap 'rm -f "$RUNTIME_PATH"' EXIT
  curl --fail --location --silent --show-error --retry 3 \
    --output "$RUNTIME_PATH" \
    https://github.com/AppImage/type2-runtime/releases/download/continuous/runtime-x86_64
fi

npm run build
npx electron-builder --linux dir --x64

if [[ ! -d "$APPDIR_PATH" ]]; then
  printf 'Error: electron-builder did not create the expected AppDir: %s\n' "$APPDIR_PATH" >&2
  exit 1
fi

if [[ ! -x "$APPDIR_PATH/yfitops" ]]; then
  printf 'Error: expected the Yfitops executable in the AppDir: %s/yfitops\n' "$APPDIR_PATH" >&2
  exit 1
fi

cp "$PROJECT_DIR/assets/icon.png" "$APPDIR_PATH/yfitops.png"
cat > "$APPDIR_PATH/yfitops.desktop" <<'DESKTOP'
[Desktop Entry]
Name=YFitops
Exec=yfitops %U
Terminal=false
Type=Application
Icon=yfitops
Categories=AudioVideo;Player;Audio;
DESKTOP

"$APPIMAGETOOL" --runtime-file "$RUNTIME_PATH" -u "$UPDATE_INFO" "$APPDIR_PATH" "$APPIMAGE_PATH"

if [[ ! -s "$APPIMAGE_PATH" || ! -s "${APPIMAGE_PATH}.zsync" ]]; then
  printf 'Error: expected both %s and its .zsync update file.\n' "$APPIMAGE_NAME" >&2
  exit 1
fi

printf 'Created %s and %s.zsync\n' "$APPIMAGE_PATH" "$APPIMAGE_PATH"