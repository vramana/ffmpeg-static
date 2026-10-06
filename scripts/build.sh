#!/bin/sh
# Builds ffmpeg and ffprobe with all third-party libraries linked statically.
#
#   TARGET=<target> sh scripts/build.sh
#
# Targets (named after Node's process.platform-process.arch):
#   linux-x64     fully static against musl; run inside Alpine (see build-linux.sh)
#   darwin-arm64  links only macOS system libraries/frameworks dynamically
#   win32-x64     MSYS2 UCRT64 shell; links only Windows system DLLs
#   win32-arm64   MSYS2 CLANGARM64 shell; links only Windows system DLLs
#
# Build tools must already be installed (see .github/workflows).
# Outputs land in $OUT_DIR (default: ./dist).
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
. "$ROOT/versions.sh"

TARGET=${TARGET:?set TARGET, e.g. TARGET=linux-x64}
WORK=${WORK_DIR:-$ROOT/.build}
PREFIX="$WORK/prefix"
OUT=${OUT_DIR:-$ROOT/dist}
JOBS=${JOBS:-$(getconf _NPROCESSORS_ONLN)}

export CC=${CC:-cc}
export CXX=${CXX:-c++}
export CFLAGS="-O2"
export CXXFLAGS="-O2"
EXE=
X86=
# Only our own prefix is visible to pkg-config, so nothing from the host
# (e.g. Homebrew) gets picked up by accident.
export PKG_CONFIG_LIBDIR="$PREFIX/lib/pkgconfig"

case "$TARGET" in
  linux-x64)
    HOST=x86_64-linux-musl
    VPX_TARGET=x86_64-linux-gcc
    X86=1
    CFLAGS="$CFLAGS -fPIC"; CXXFLAGS="$CXXFLAGS -fPIC"
    FFMPEG_LDFLAGS="-static"
    FFMPEG_LIBS="-lpthread -lm -lstdc++"
    ;;
  darwin-arm64)
    HOST=aarch64-apple-darwin
    VPX_TARGET=arm64-darwin20-gcc
    export MACOSX_DEPLOYMENT_TARGET=${MACOSX_DEPLOYMENT_TARGET:-11.0}
    FFMPEG_LDFLAGS=""
    # configure enables iconv but doesn't always add -liconv for the final link.
    FFMPEG_LIBS="-lc++ -liconv"
    # Keep ffmpeg from probing for optional host libraries; enable only
    # what ships with macOS.
    FFMPEG_PLATFORM_FLAGS="--disable-autodetect --enable-zlib --enable-bzlib --enable-iconv
      --enable-videotoolbox --enable-audiotoolbox"
    ;;
  win32-x64)
    HOST=x86_64-w64-mingw32
    VPX_TARGET=x86_64-win64-gcc
    X86=1
    EXE=.exe
    FFMPEG_LDFLAGS="-static"
    FFMPEG_LIBS="-lstdc++"
    ;;
  win32-arm64)
    HOST=aarch64-w64-mingw32
    VPX_TARGET=arm64-win64-gcc
    # Opus has no runtime CPU detection for Windows on ARM; NEON is baseline
    # on arm64, so build it in unconditionally.
    OPUS_FLAGS="--disable-rtcd"
    EXE=.exe
    FFMPEG_LDFLAGS="-static"
    FFMPEG_LIBS="-lc++"
    # On the case-insensitive filesystem, libc++'s <version> resolves to
    # FFmpeg's top-level VERSION file and breaks this C++ screen-capture filter.
    FFMPEG_PLATFORM_FLAGS="--disable-filter=gfxcapture"
    ;;
  *) echo "unknown TARGET: $TARGET" >&2; exit 1 ;;
esac
FFMPEG_PLATFORM_FLAGS=${FFMPEG_PLATFORM_FLAGS:-}
OPUS_FLAGS=${OPUS_FLAGS:-}

mkdir -p "$WORK/src" "$PREFIX" "$OUT"

sha256_check() {
  if command -v sha256sum >/dev/null 2>&1; then
    echo "$1  $2" | sha256sum -c -
  else
    echo "$1  $2" | shasum -a 256 -c -
  fi
}

# fetch <url> <sha256> <dir>: download, verify and unpack into $WORK/src/<dir>.
# A server can answer 200 with something else (e.g. a bot-check page), so a
# mismatch is retried and what arrived is printed.
fetch() {
  archive="$WORK/src/$(basename "$1")"
  attempt=1
  while :; do
    [ -f "$archive" ] || curl -fsSL --retry 5 -o "$archive" "$1"
    sha256_check "$2" "$archive" && break
    echo "checksum mismatch for $1 (attempt $attempt), received:" >&2
    head -c 200 "$archive" | tr -c '[:print:]\n' '.' >&2; echo >&2
    rm -f "$archive"
    [ "$attempt" -ge 3 ] && return 1
    attempt=$((attempt + 1))
    sleep 15
  done
  rm -rf "$WORK/src/$3" && mkdir -p "$WORK/src/$3"
  tar -xf "$archive" -C "$WORK/src/$3" --strip-components=1
}

# git_fetch <repo> <commit> <dir>: shallow-fetch exactly that commit into $WORK/src/<dir>.
git_fetch() {
  rm -rf "$WORK/src/$3" && git init -q "$WORK/src/$3"
  git -C "$WORK/src/$3" fetch -q --depth 1 "$1" "$2"
  git -C "$WORK/src/$3" -c advice.detachedHead=false checkout -q FETCH_HEAD
  test "$(git -C "$WORK/src/$3" rev-parse HEAD)" = "$2"
}

build_x264() {
  git_fetch "$X264_GIT" "$X264_COMMIT" x264
  cd "$WORK/src/x264"
  ./configure --prefix="$PREFIX" --host="$HOST" --enable-static --enable-pic --disable-cli
  make -j"$JOBS" && make install
}

build_x265() {
  fetch "$X265_URL" "$X265_SHA256" x265
  mkdir -p "$WORK/src/x265/build-static" && cd "$WORK/src/x265/build-static"
  cmake ../source -G Ninja \
    -DCMAKE_INSTALL_PREFIX="$PREFIX" -DCMAKE_BUILD_TYPE=Release \
    -DENABLE_SHARED=OFF -DENABLE_CLI=OFF
  ninja -j"$JOBS" && ninja install
  # x265 advertises -lgcc_s, which has no static archive and breaks -static links.
  pc="$PREFIX/lib/pkgconfig/x265.pc"
  sed 's/ -lgcc_s//g' "$pc" > "$pc.tmp" && mv "$pc.tmp" "$pc"
}

build_libvpx() {
  git_fetch "$LIBVPX_GIT" "$LIBVPX_COMMIT" libvpx
  cd "$WORK/src/libvpx"
  ./configure --prefix="$PREFIX" --target="$VPX_TARGET" \
    --enable-static --disable-shared --enable-pic \
    --disable-examples --disable-tools --disable-docs --disable-unit-tests \
    --enable-vp9-highbitdepth
  make -j"$JOBS" && make install
}

build_lame() {
  fetch "$LAME_URL" "$LAME_SHA256" lame
  cd "$WORK/src/lame"
  ./configure --prefix="$PREFIX" --host="$HOST" --enable-static --disable-shared \
    --disable-frontend --disable-gtktest ${X86:+--enable-nasm}
  make -j"$JOBS" && make install
}

build_opus() {
  fetch "$OPUS_URL" "$OPUS_SHA256" opus
  cd "$WORK/src/opus"
  ./configure --prefix="$PREFIX" --host="$HOST" --enable-static --disable-shared \
    --disable-doc --disable-extra-programs $OPUS_FLAGS
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
  # shellcheck disable=SC2086 # FFMPEG_PLATFORM_FLAGS is a list of flags
  ./configure \
    --prefix="$PREFIX" \
    --cc="$CC" --cxx="$CXX" \
    --pkg-config-flags="--static" \
    --extra-cflags="-I$PREFIX/include" \
    --extra-ldflags="-L$PREFIX/lib $FFMPEG_LDFLAGS" \
    --extra-ldexeflags="$FFMPEG_LDFLAGS" \
    --extra-libs="$FFMPEG_LIBS" \
    --extra-version="ffmpeg-static" \
    --enable-static --disable-shared \
    --disable-debug --disable-doc --disable-ffplay \
    --enable-gpl \
    --enable-zlib \
    --enable-libx264 --enable-libx265 --enable-libvpx \
    --enable-libmp3lame --enable-libopus --enable-libdav1d \
    $FFMPEG_PLATFORM_FLAGS
  make -j"$JOBS"
  for bin in ffmpeg ffprobe; do
    cp "$bin$EXE" "$OUT/$bin$EXE"
    strip "$OUT/$bin$EXE"
  done
}

build_x264
build_x265
build_libvpx
build_lame
build_opus
build_dav1d
build_ffmpeg

"$OUT/ffmpeg$EXE" -hide_banner -version
