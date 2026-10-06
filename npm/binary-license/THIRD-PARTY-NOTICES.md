# Third-party notices

The `ffmpeg` and `ffprobe` binaries in this package are built from the
components below and are distributed under the **GNU General Public License,
version 2 or later** (see `LICENSE`), because FFmpeg is configured with
`--enable-gpl` and links x264 and x265.

| Component | Version | License | Source |
|---|---|---|---|
| FFmpeg | 9.0.2 | GPL-2.0-or-later (as built) | https://ffmpeg.org/releases/ffmpeg-9.0.2.tar.xz |
| x264 | stable @ b35605ace3ddf7c1a5d67a2eb553f034aef41d55 | GPL-2.0-or-later | https://code.videolan.org/videolan/x264 |
| x265 | 4.2 | GPL-2.0-or-later | https://bitbucket.org/multicoreware/x265_git |
| libvpx | 1.17.0 | BSD-3-Clause | https://github.com/webmproject/libvpx |
| LAME | 3.100 | LGPL-2.0-or-later | https://lame.sourceforge.io |
| Opus | 1.6.1 | BSD-3-Clause | https://opus-codec.org |
| dav1d | 1.5.4 | BSD-2-Clause | https://code.videolan.org/videolan/dav1d |

The linux-x64 binary also statically includes musl libc (MIT); the Windows
binaries include the MinGW-w64 runtime (various permissive licenses).

## Corresponding source

The exact source versions and their SHA-256 checksums are pinned in
`versions.sh`, and the complete build scripts are in the same repository:
https://github.com/vramana/ffmpeg-static
