#!/bin/sh
# Sanity-checks built binaries: usage: smoke-test.sh <dir containing ffmpeg/ffprobe>
set -eu

DIR=$(cd "${1:-dist}" && pwd)
FFMPEG="$DIR/ffmpeg"
FFPROBE="$DIR/ffprobe"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

"$FFMPEG" -hide_banner -version
"$FFPROBE" -hide_banner -version

# Must not depend on any shared library.
if command -v ldd >/dev/null 2>&1 && ldd "$FFMPEG" 2>&1 | grep -q '=>'; then
  echo "ffmpeg is dynamically linked:" >&2
  ldd "$FFMPEG" >&2
  exit 1
fi

# Encode with each external codec, then decode the result back.
i=0
for spec in \
  "mp4 -c:v libx264" \
  "mp4 -c:v libx265" \
  "webm -c:v libvpx-vp9" \
  "mp3 -vn -c:a libmp3lame" \
  "ogg -vn -c:a libopus"; do
  set -- $spec
  ext=$1; shift
  i=$((i + 1))
  out="$TMP/out-$i.$ext"
  "$FFMPEG" -hide_banner -loglevel error -y \
    -f lavfi -i testsrc=duration=1:size=320x240:rate=25 \
    -f lavfi -i sine=frequency=440:duration=1 \
    "$@" "$out"
  "$FFMPEG" -hide_banner -loglevel error -i "$out" -f null -
  "$FFPROBE" -hide_banner -loglevel error -show_entries stream=codec_name -of csv=p=0 "$out"
done

# No AV1 encoder is bundled, so just check the libdav1d decoder is registered.
"$FFMPEG" -hide_banner -decoders | grep -q libdav1d

echo "smoke test passed"
