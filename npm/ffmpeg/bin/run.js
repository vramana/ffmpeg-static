'use strict';

const { spawnSync } = require('node:child_process');
const { constants } = require('node:os');
const paths = require('../index.js');

// Runs the bundled binary with this process's arguments and stdio, and exits
// the same way it did.
module.exports = function run(name) {
  const result = spawnSync(paths[`${name}Path`], process.argv.slice(2), {
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  // Killed by a signal: use the shell convention of 128 + signal number.
  process.exit(result.status ?? 128 + (constants.signals[result.signal] ?? 0));
};
