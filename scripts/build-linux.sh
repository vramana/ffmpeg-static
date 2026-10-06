#!/bin/sh
# Builds fully static ffmpeg and ffprobe binaries against musl.
# Meant to run as root inside an Alpine container, e.g.:
#   docker run --rm -v "$PWD:/src" -w /src alpine:3.22 sh scripts/build-linux.sh
# Outputs land in $OUT_DIR (default: ./dist).
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
. "$ROOT/versions.sh"

WORK=${WORK_DIR:-/tmp/ffmpeg-build}
PREFIX="$WORK/prefix"
OUT=${OUT_DIR:-$ROOT/dist}
JOBS=${JOBS:-$(nproc)}

apk add --no-cache \
  build-base linux-headers nasm cmake meson ninja-build pkgconf \
  git curl perl bash diffutils coreutils file \
  zlib-dev zlib-static

mkdir -p "$WORK/src" "$PREFIX" "$OUT"
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig"
export PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig:/usr/lib/pkgconfig"
export CFLAGS="-O2 -fPIC"
export CXXFLAGS="-O2 -fPIC"

# fetch <url> <sha256> <dir>: download, verify and unpack into $WORK/src/<dir>
fetch() {
  archive="$WORK/src/$(basename "$1")"
  [ -f "$archive" ] || curl -fsSL --retry 5 -o "$archive" "$1"
  echo "$2  $archive" | sha256sum -c -
  rm -rf "$WORK/src/$3" && mkdir -p "$WORK/src/$3"
  tar -xf "$archive" -C "$WORK/src/$3" --strip-components=1
}

build_x264() {
  fetch "$X264_URL" "$X264_SHA256" x264
  cd "$WORK/src/x264"
  ./configure --prefix="$PREFIX" --enable-static --enable-pic --disable-cli
  make -j"$JOBS" && make install
}

build_x265() {
  fetch "$X265_URL" "$X265_SHA256" x265
  mkdir -p "$WORK/src/x265/build-static" && cd "$WORK/src/x265/build-static"
  cmake ../source -G Ninja \
    -DCMAKE_INSTALL_PREFIX="$PREFIX" -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_POLICY_VERSION_MINIMUM=3.5 \
    -DENABLE_SHARED=OFF -DENABLE_CLI=OFF
  ninja -j"$JOBS" && ninja install
}

build_libvpx() {
  rm -rf "$WORK/src/libvpx"
  git -c advice.detachedHead=false clone --depth 1 --branch "v$LIBVPX_VERSION" \
    "$LIBVPX_GIT" "$WORK/src/libvpx"
  cd "$WORK/src/libvpx"
  test "$(git rev-parse HEAD)" = "$LIBVPX_COMMIT"
  ./configure --prefix="$PREFIX" --enable-static --disable-shared --enable-pic \
    --disable-examples --disable-tools --disable-docs --disable-unit-tests \
    --enable-vp9-highbitdepth
  make -j"$JOBS" && make install
}

build_lame() {
  fetch "$LAME_URL" "$LAME_SHA256" lame
  cd "$WORK/src/lame"
  ./configure --prefix="$PREFIX" --enable-static --disable-shared \
    --disable-frontend --disable-gtktest --enable-nasm
  make -j"$JOBS" && make install
}

build_opus() {
  fetch "$OPUS_URL" "$OPUS_SHA256" opus
  cd "$WORK/src/opus"
  ./configure --prefix="$PREFIX" --enable-static --disable-shared \
    --disable-doc --disable-extra-programs
  make -j"$JOBS" && make install
}

build_dav1d() {
  fetch "$DAV1D_URL" "$DAV1D_SHA256" dav1d
  cd "$WORK/src/dav1d"
  meson setup build --prefix="$PREFIX" --libdir=lib --buildtype=release \
    --default-library=static -Denable_tools=false -Denable_tests=false
  ninja -C build -j"$JOBS" && ninja -C build install
}

build_ffmpeg() {
  fetch "$FFMPEG_URL" "$FFMPEG_SHA256" ffmpeg
  cd "$WORK/src/ffmpeg"
  ./configure \
    --prefix="$PREFIX" \
    --pkg-config-flags="--static" \
    --extra-cflags="-I$PREFIX/include" \
    --extra-ldflags="-L$PREFIX/lib -static" \
    --extra-ldexeflags="-static" \
    --extra-libs="-lpthread -lm -lstdc++" \
    --extra-version="ffmpeg-static" \
    --enable-static --disable-shared \
    --disable-debug --disable-doc --disable-ffplay \
    --enable-gpl \
    --enable-zlib \
    --enable-libx264 --enable-libx265 --enable-libvpx \
    --enable-libmp3lame --enable-libopus --enable-libdav1d
  make -j"$JOBS"
  strip -o "$OUT/ffmpeg" ffmpeg
  strip -o "$OUT/ffprobe" ffprobe
}

build_x264
build_x265
build_libvpx
build_lame
build_opus
build_dav1d
build_ffmpeg

file "$OUT/ffmpeg" "$OUT/ffprobe"
"$OUT/ffmpeg" -hide_banner -version
