# ffmpeg-static

Automated, reproducible static builds of [FFmpeg](https://ffmpeg.org) for all
major platforms, published to npm.

> Status: work in progress. Builds run in CI; nothing is published to npm yet.

## What's built

| | |
|---|---|
| FFmpeg | 9.0.2 (pinned in [`versions.sh`](versions.sh)) |
| Binaries | `ffmpeg`, `ffprobe` |
| License | GPL (because of x264/x265) |
| External libs | x264, x265, libvpx (VP8/VP9), LAME (MP3), Opus, dav1d (AV1 decode), zlib |

Every source tarball is verified against a pinned SHA-256 (libvpx is pinned to
a git commit). All of these libraries are linked statically on every platform.

| Target | Runner | How | Runtime dependencies |
|---|---|---|---|
| `darwin-arm64` | `macos-15` | Apple clang, macOS 11+ | macOS system libraries and frameworks only |
| `win32-x64` | `windows-2025` | MSYS2 UCRT64 (GCC) | Windows system DLLs only |
| `win32-arm64` | `windows-11-arm` | MSYS2 CLANGARM64 (clang) | Windows system DLLs only |
| `linux-x64` | `ubuntu-24.04` | Alpine/musl, fully static | none |

The Linux build is currently disabled (manual runs only).

## Getting a build

The [`Build`](.github/workflows/build.yml) workflow builds macOS and Windows on
every push and pull request, and can be run on demand from the Actions tab.
Each target is uploaded as an `ffmpeg-<target>` artifact, e.g.
`ffmpeg-darwin-arm64`. Linux has its own manual-only
[`Build linux-x64`](.github/workflows/build-linux-x64.yml) workflow.

Download from the run's summary page, or with the GitHub CLI:

```sh
gh run download <run-id> -n ffmpeg-darwin-arm64
chmod +x ffmpeg ffprobe   # artifacts don't preserve the executable bit
xattr -d com.apple.quarantine ffmpeg ffprobe 2>/dev/null   # unsigned binaries
./ffmpeg -version
```

## Building locally

All targets use [`scripts/build.sh`](scripts/build.sh); the workflows show
which tools to install first.

```sh
# Linux (in Docker)
docker run --rm -v "$PWD:/src" -w /src alpine:3.22 sh scripts/build-linux.sh

# macOS
brew install meson ninja pkgconf
TARGET=darwin-arm64 sh scripts/build.sh

# then
sh scripts/smoke-test.sh dist
```

## Updating FFmpeg or a dependency

Edit the version and checksum in [`versions.sh`](versions.sh). To get the
checksum: `curl -fsSL <url> | sha256sum`.
