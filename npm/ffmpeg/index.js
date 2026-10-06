'use strict';

const path = require('node:path');

const target = `${process.platform}-${process.arch}`;
const pkg = `@vramana/ffmpeg-${target}`;
const supported = Object.keys(require('./package.json').optionalDependencies)
  .map((name) => name.slice('@vramana/ffmpeg-'.length));

function binaryPath(name) {
  if (!supported.includes(target)) {
    throw new Error(
      `@vramana/ffmpeg has no binaries for ${target}. ` +
        `Supported platforms: ${supported.join(', ')}.`,
    );
  }
  let dir;
  try {
    dir = path.dirname(require.resolve(`${pkg}/package.json`));
  } catch {
    throw new Error(
      `@vramana/ffmpeg could not find ${pkg}. It is installed as an optional ` +
        'dependency; make sure optional dependencies are not omitted ' +
        '(e.g. --omit=optional / --no-optional) and reinstall.',
    );
  }
  return path.join(dir, process.platform === 'win32' ? `${name}.exe` : name);
}

let ffmpegPath;
let ffprobePath;

module.exports = {
  /** Absolute path to the ffmpeg binary for this platform. */
  get ffmpegPath() {
    return (ffmpegPath ??= binaryPath('ffmpeg'));
  },
  /** Absolute path to the ffprobe binary for this platform. */
  get ffprobePath() {
    return (ffprobePath ??= binaryPath('ffprobe'));
  },
};
