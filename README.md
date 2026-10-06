# ffmpeg-static

Static [FFmpeg](https://ffmpeg.org) binaries (`ffmpeg` and `ffprobe`) for Linux,
macOS and Windows, built from source in CI and published to npm.

> Not on npm yet. Builds and tests run on every push.

## Usage

```sh
npm install @vramana/ffmpeg
```

```js
import { ffmpegPath, ffprobePath } from '@vramana/ffmpeg';
import { execFileSync } from 'node:child_process';

execFileSync(ffmpegPath, ['-i', 'input.mov', 'output.mp4']);
```

You can also run `npx ffmpeg` and `npx ffprobe`.

npm downloads only the binary for your platform; there's no install script.

## Platforms

| Platform | Notes |
|---|---|
| Linux x64 | Fully static, works on glibc and musl (Alpine) distros |
| macOS arm64 | macOS 11 or later |
| Windows x64 | |
| Windows arm64 | |

FFmpeg 9.0.2 with x264, x265, libvpx (VP8/VP9), LAME (MP3), Opus and dav1d (AV1).

## How it works

1. [`versions.sh`](versions.sh) pins every source by checksum or git commit.
2. [`scripts/build.sh`](scripts/build.sh) builds the libraries and FFmpeg for
   one platform, linking everything statically.
3. [`scripts/smoke-test.sh`](scripts/smoke-test.sh) checks each binary encodes
   and decodes, and depends only on libraries the OS ships.
4. [`scripts/npm-prepare.mjs`](scripts/npm-prepare.mjs) puts the binaries into
   the packages in [`npm/`](npm): one main package plus one per platform.
5. CI installs those packages on every OS and runs
   [`test/browser.test.mjs`](test/browser.test.mjs), where Chrome and ffmpeg
   each have to read video the other produced.

## Building locally

```sh
# Linux, in Docker
docker run --rm -v "$PWD:/src" -w /src alpine:3.22 sh scripts/build-linux.sh

# macOS
brew install meson ninja pkgconf
TARGET=darwin-arm64 sh scripts/build.sh

# Windows: see .github/workflows/build.yml for the MSYS2 setup

sh scripts/smoke-test.sh dist
```

To update FFmpeg or a library, change its version and checksum in
`versions.sh`.

## License

The code in this repository is [MIT](LICENSE).

The FFmpeg binaries are **GPL v2 or later**, because they include x264 and
x265. Each platform package ships the GPL text and a
[notice](licenses/binaries/THIRD-PARTY-NOTICES.md) listing every component and
its source.
