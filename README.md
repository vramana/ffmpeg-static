# ffmpeg-static

Automated, reproducible static builds of [FFmpeg](https://ffmpeg.org) for all
major platforms, published to npm.

> Status: work in progress. Builds run in CI; nothing is published to npm yet.

## What's built

| | |
|---|---|
| FFmpeg | 9.0.2 (pinned in [`versions.sh`](versions.sh)) |
| Binaries | `ffmpeg`, `ffprobe` |
| License | Binaries: GPL-2.0-or-later (because of x264/x265). This repository's code: MIT |
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

## npm packages

[`npm/`](npm) holds the packages, following the esbuild layout:
`@vramana/ffmpeg` exports `ffmpegPath`/`ffprobePath` and lists one package per
target as `optionalDependencies`; each of those declares `os`/`cpu`, so npm
installs only the matching one. The single `linux-x64` package works on both
glibc and musl distros because the binary links no libc dynamically.

Binaries aren't committed. At release time:

```sh
gh run download <run-id> -p 'ffmpeg-*' -D artifacts
node scripts/npm-prepare.mjs --artifacts artifacts --version <x.y.z>
```

This copies each target's binaries into its package (restoring the executable
bit) and sets the same version on every package. The `Build` workflow does
this on every run, then installs the packed tarballs on each OS and runs them.

## Tests

- [`scripts/smoke-test.sh`](scripts/smoke-test.sh) runs right after each
  build: it encodes and decodes with every bundled codec and fails if a binary
  needs a library the OS doesn't ship.
- [`test/browser.test.mjs`](test/browser.test.mjs) runs against the installed
  npm package on each OS. Chrome (via Puppeteer) records a canvas animation with
  `MediaRecorder`; ffmpeg must probe it, extract frames whose pixels match the
  painted colors, and transcode it with every encoder. Then Chrome plays back
  VP9 and H.264 files encoded by ffmpeg and checks their pixels too.

  ```sh
  # in a project with @vramana/ffmpeg installed
  npm install puppeteer
  cp <repo>/test/browser.test.mjs . && node --test browser.test.mjs
  ```

## Updating FFmpeg or a dependency

Edit the version and checksum in [`versions.sh`](versions.sh). To get the
checksum: `curl -fsSL <url> | sha256sum`.

## License

The code in this repository (build scripts, workflows, the `@vramana/ffmpeg`
JavaScript wrapper, tests) is [MIT](LICENSE).

The FFmpeg binaries it builds are a separate work under the **GPL v2 or later**,
because FFmpeg is configured with `--enable-gpl` and links x264 and x265. Each
platform package (`@vramana/ffmpeg-<target>`) ships the GPL text and a
[third-party notice](licenses/binaries/THIRD-PARTY-NOTICES.md) listing every
component, its license and where its source lives.
