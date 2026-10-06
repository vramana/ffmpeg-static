# @vramana/ffmpeg

Static [FFmpeg](https://ffmpeg.org) 9.0.2 `ffmpeg` and `ffprobe` binaries for
Linux, macOS and Windows. npm installs only the binary for your platform.

| Platform | Package |
|---|---|
| Linux x64 (glibc and musl) | `@vramana/ffmpeg-linux-x64` |
| macOS arm64 | `@vramana/ffmpeg-darwin-arm64` |
| Windows x64 | `@vramana/ffmpeg-win32-x64` |
| Windows arm64 | `@vramana/ffmpeg-win32-arm64` |

```sh
npm install @vramana/ffmpeg
```

```js
const { ffmpegPath, ffprobePath } = require('@vramana/ffmpeg');
// or: import { ffmpegPath, ffprobePath } from '@vramana/ffmpeg';

const { execFileSync } = require('node:child_process');
execFileSync(ffmpegPath, ['-i', 'in.mov', 'out.mp4']);
```

`npx ffmpeg` and `npx ffprobe` also work.

The binaries are installed through `optionalDependencies`, so don't install
with `--omit=optional`.

Includes x264, x265, libvpx, LAME, Opus and dav1d. Because of x264/x265 the
binaries are licensed under the GPL.
