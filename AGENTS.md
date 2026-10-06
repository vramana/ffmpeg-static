# Agent instructions

## Versioning

- npm package versions are **independent of the FFmpeg version**. Don't try to
  keep them in sync. The FFmpeg version lives only in `versions.sh`.
- Versions start at **9.0.0** and follow semver for this project's own changes.
- Every package (`@vramana/ffmpeg` and all `@vramana/ffmpeg-<target>` packages)
  is released with the same version. `scripts/npm-prepare.mjs --version` sets it
  on all of them; don't edit the `version` fields in `npm/*/package.json` by
  hand (they stay `0.0.0` in git).
- Publish release candidates first (`9.0.0-rc.1`, `9.0.0-rc.2`, …) under a
  non-default npm dist-tag. Publish the final version (`9.0.0`) as `latest`
  only after the RC has been verified.
