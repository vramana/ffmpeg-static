# ffmpeg-static

Automated, reproducible static builds of [FFmpeg](https://ffmpeg.org) for all
major platforms, published to npm.

> Status: work in progress. Only **linux-x64** is built so far, and nothing is
> published to npm yet.

## What's built

| | |
|---|---|
| FFmpeg | 9.0.2 (pinned in [`versions.sh`](versions.sh)) |
| Binaries | `ffmpeg`, `ffprobe` |
| License | GPL (because of x264/x265) |
| External libs | x264, x265, libvpx (VP8/VP9), LAME (MP3), Opus, dav1d (AV1 decode), zlib |

Every source tarball is verified against a pinned SHA-256 (libvpx is pinned to
a git commit).

### linux-x64

Built inside an Alpine container against musl and linked fully statically, so
the binaries run on any x86-64 Linux distribution regardless of its libc.

## Getting a build

The [`Build linux-x64`](.github/workflows/build-linux-x64.yml) workflow runs on
every push, on pull requests, and on demand (*Actions → Build
linux-x64 → Run workflow*). It uploads an `ffmpeg-linux-x64` artifact
containing `ffmpeg` and `ffprobe`.

Download it from the run's summary page, or with the GitHub CLI:

```sh
gh run download <run-id> -n ffmpeg-linux-x64
chmod +x ffmpeg ffprobe   # artifacts don't preserve the executable bit
./ffmpeg -version
```

## Building locally

```sh
docker run --rm -v "$PWD:/src" -w /src alpine:3.22 sh scripts/build-linux.sh
sh scripts/smoke-test.sh dist
```

## Updating FFmpeg or a dependency

Edit the version and checksum in [`versions.sh`](versions.sh). To get the
checksum: `curl -fsSL <url> | sha256sum`.
