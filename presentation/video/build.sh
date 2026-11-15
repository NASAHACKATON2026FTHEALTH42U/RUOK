#!/usr/bin/env bash
# Monta el vídeo de 30 s: fotogramas de render.mjs + locución (voiceover.py), 1080p30 H.264/AAC.
# Uso: bash build.sh <carpeta-de-fotogramas> <salida.mp4>
set -euo pipefail
cd "$(dirname "$0")"
FRAMES=${1:-frames}
OUT=${2:-../ruok-pitch-30s.mp4}
FFMPEG=${FFMPEG:-$(uv run --no-project --with imageio-ffmpeg python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())" | tail -1)}
"$FFMPEG" -hide_banner -loglevel error -y \
  -framerate 30 -i "$FRAMES/%05d.jpg" -i voiceover.mp3 \
  -filter_complex "[1:a]adelay=600|600,apad,afade=t=out:st=29.3:d=0.7,loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
  -map 0:v -map "[a]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -ar 48000 -t 30 -movflags +faststart "$OUT"
echo "vídeo: $OUT"
