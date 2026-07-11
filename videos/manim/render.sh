#!/usr/bin/env bash
# Renders all Manim scenes to MP4 clips for Remotion to composite.
# Output goes to ../public/manim/ so Remotion can reference them via staticFile().

set -euo pipefail
cd "$(dirname "$0")"

OUT="../public/manim"
mkdir -p "$OUT"

SCENES=(SkillMeshGraph PipelineFSM MemoryWings TekioWheel)

echo "=== Rendering ${#SCENES[@]} Manim scenes ==="

for scene in "${SCENES[@]}"; do
  echo "> $scene"
  manim render -qh --fps 30 --format mp4 \
    --media_dir /tmp/manim_media \
    ultrathink_scenes.py "$scene"

  # Manim outputs to a known path pattern
  RENDERED="/tmp/manim_media/videos/ultrathink_scenes/1080p30/${scene}.mp4"
  if [[ -f "$RENDERED" ]]; then
    cp "$RENDERED" "$OUT/${scene}.mp4"
    echo "  ok $OUT/${scene}.mp4 ($(du -h "$OUT/${scene}.mp4" | cut -f1))"
  else
    echo "  FAIL: render failed for $scene"
    echo "  Looking in: /tmp/manim_media/videos/ultrathink_scenes/1080p30/"
    ls -la /tmp/manim_media/videos/ultrathink_scenes/1080p30/ 2>/dev/null || true
    exit 1
  fi
done

echo ""
echo "=== Done ==="
ls -la "$OUT"
