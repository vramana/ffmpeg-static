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

## Publishing to npm

Use [Actions → Publish npm release → Run workflow](https://github.com/vramana/ffmpeg-static/actions/workflows/publish.yml)
and select `main`. Enter the exact version, starting with `9.0.0-rc.1`.
Leave **Publish to npm** unchecked for a preview: the workflow builds all four
platforms, runs smoke/package/browser tests, and uploads all five tarballs in
the `npm-release-<version>` artifact. Check it when you want the workflow to
publish after those checks pass.

### One-time setup

1. In GitHub **Settings → General → Default branch**, select `main` so the
   manual release workflow appears in the Actions UI.
2. You need an npm account with permission to publish under `@vramana`.
   For the first release, create a [granular npm access token](https://docs.npmjs.com/creating-and-viewing-access-tokens/)
   with **Read and write (publish and stage)** permission for the `@vramana`
   scope and **Bypass two-factor authentication** enabled for unattended
   publishing. Add it as `NPM_TOKEN` under GitHub **Settings → Environments →
   npm-release → Environment secrets**. Create that environment if needed.
   Keep the token in GitHub secrets; do not put it in repository files.
3. Run the workflow with version `9.0.0-rc.1` and **Publish to npm** checked.
   Each platform package is published first; the main package is published last.
4. Once the packages exist, configure [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
   in the settings of **all five packages**. Use GitHub owner `vramana`,
   repository `ffmpeg-static`, workflow filename `publish.yml`, environment
   `npm-release`, and allow direct **npm publish**. Subsequent releases use
   OIDC authentication. After verifying an OIDC release, remove/revoke the
   bootstrap `NPM_TOKEN`.

The packages are `@vramana/ffmpeg`, `@vramana/ffmpeg-darwin-arm64`,
`@vramana/ffmpeg-linux-x64`, `@vramana/ffmpeg-win32-arm64`, and
`@vramana/ffmpeg-win32-x64`.

### Choosing the next version

All five packages share one version. The major follows FFmpeg; minor and patch
are this project's own. Use a patch bump for fixes and a minor bump for new
features, platforms, codecs, or FFmpeg minor/patch updates. Version fields in
`npm/*/package.json` stay `0.0.0` in git; the workflow stamps the requested
version with `scripts/npm-prepare.mjs`.

Release candidates such as `9.0.0-rc.1` and `9.0.0-rc.2` automatically use the
`rc` npm tag. Install the candidate on the supported platforms:

```sh
npm install @vramana/ffmpeg@9.0.0-rc.1
npx ffmpeg -hide_banner -version
npx ffprobe -hide_banner -version
```

After verifying an RC, run the workflow with `9.0.0`, check **Publish to npm**
and **I have installed and verified an RC for this stable version**. Stable
versions automatically use `latest`. The workflow checks that a matching RC
exists on every package and rejects already-published versions. For the next
fix, follow the same process with `9.0.1-rc.1`, then `9.0.1`.

If publication stops partway through, choose a fresh RC version and rerun;
npm versions cannot be overwritten. The run summary records the source commit
and version, and the tarballs remain available as a workflow artifact.

## License

The code in this repository is [MIT](LICENSE).

The FFmpeg binaries are **GPL v2 or later**, because they include x264 and
x265. Each platform package ships the GPL text and a
[notice](licenses/binaries/THIRD-PARTY-NOTICES.md) listing every component and
its source.
