# Agent instructions

## Versioning

- npm versions are `<FFmpeg major>.<minor>.<patch>`. Only the **major** version
  follows FFmpeg; minor and patch are this project's own and don't track
  FFmpeg's minor or patch releases.
  - With FFmpeg 9.x the first release is **9.0.0**.
  - Moving to a new FFmpeg major version (e.g. 10.x) starts at **10.0.0**.
  - Within a major version, bump minor for new features (codecs, platforms,
    an FFmpeg minor/patch update) and patch for fixes.
- The FFmpeg version itself lives only in `versions.sh`.
- Every package (`@vramana/ffmpeg` and all `@vramana/ffmpeg-<target>` packages)
  is released with the same version. `scripts/npm-prepare.mjs --version` sets it
  on all of them; don't edit the `version` fields in `npm/*/package.json` by
  hand (they stay `0.0.0` in git).
- Publish release candidates first (`9.0.0-rc.1`, `9.0.0-rc.2`, …) under a
  non-default npm dist-tag. Publish the final version (`9.0.0`) as `latest`
  only after the RC has been verified.
