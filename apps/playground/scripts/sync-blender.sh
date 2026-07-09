#!/usr/bin/env bash
# Sync Blender exports (character GLBs + textures) into playground public folder.
# Additive: only copies new/updated files, never deletes (color variants etc. are safe).
# Usage: pnpm sync:blender [--dry-run]
set -euo pipefail

SRC="$HOME/Blender/Projects/Artificier Forge/models"
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/models/characters"

RSYNC_FLAGS=(-av --update)
if [[ "${1:-}" == "--dry-run" || "${1:-}" == "-n" ]]; then
  RSYNC_FLAGS+=(--dry-run)
  echo "(dry run, nothing will be copied)"
fi

if [[ ! -d "$SRC/exports" ]]; then
  echo "error: Blender exports folder not found at $SRC/exports" >&2
  exit 1
fi

# Slot folders (bodies, heads, hair, armors, ...): GLBs only
for dir in "$SRC/exports"/*/; do
  slot="$(basename "$dir")"
  rsync "${RSYNC_FLAGS[@]}" --include='*.glb' --exclude='*' "$dir" "$DEST/$slot/"
done

# Canonical rig
if [[ -f "$SRC/exports/rig_medium.glb" ]]; then
  rsync "${RSYNC_FLAGS[@]}" "$SRC/exports/rig_medium.glb" "$DEST/rig_medium.glb"
fi

# Textures: PNGs next to the .blend files (non-recursive)
rsync "${RSYNC_FLAGS[@]}" --include='*.png' --exclude='*' "$SRC/" "$DEST/textures/"

echo
echo "done. New GLBs need a dev-server restart to appear in the part manifest."
