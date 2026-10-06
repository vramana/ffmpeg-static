#!/bin/sh
# Builds the linux-x64 binaries. Run as root inside Alpine, e.g.:
#   docker run --rm -v "$PWD:/src" -w /src alpine:3.22 sh scripts/build-linux.sh
set -eu

apk add --no-cache \
  build-base linux-headers nasm cmake meson samurai pkgconf \
  git curl perl bash diffutils coreutils \
  zlib-dev zlib-static

TARGET=linux-x64 WORK_DIR=${WORK_DIR:-/tmp/ffmpeg-build} \
  exec sh "$(dirname "$0")/build.sh"
