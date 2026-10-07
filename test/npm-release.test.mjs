import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkRegistry, validateRelease } from '../scripts/npm-release.mjs';

const input = { version: '9.0.0-rc.1', ffmpegVersion: '9.0.2', ref: 'refs/heads/main', verifiedRc: 'false' };
const names = ['@vramana/ffmpeg-linux-x64', '@vramana/ffmpeg'];
const metadata = (versions, status = 200) => ({ ok: status === 200, status, json: async () => ({ versions }) });

test('RCs use rc and stable releases use latest after explicit RC verification', () => {
  assert.deepEqual(validateRelease(input), { version: '9.0.0-rc.1', tag: 'rc' });
  assert.deepEqual(validateRelease({ ...input, version: '9.0.0', verifiedRc: 'true' }), { version: '9.0.0', tag: 'latest' });
});

test('rejects malformed versions, a different FFmpeg major, and releases off main', () => {
  for (const version of ['9.0.0-rc.0', '9.0.0-rc.01', '09.0.0', 'v9.0.0', '9.0.0-beta.1', '9.0.0+build', '9.0.0\n', '$(false)', '10.0.0-rc.1']) {
    assert.throws(() => validateRelease({ ...input, version }));
  }
  assert.throws(() => validateRelease({ ...input, ref: 'refs/heads/feature' }), /main branch/);
});

test('stable publishing requires RC verification', () => {
  assert.throws(() => validateRelease({ ...input, version: '9.0.0' }), /RC verification/);
});

test('allows bootstrapping packages not yet on npm', async () => {
  await checkRegistry(validateRelease(input), names, async () => metadata({}, 404));
});

test('refuses to overwrite any published package version', async () => {
  await assert.rejects(checkRegistry(validateRelease(input), names, async () => metadata({ '9.0.0-rc.1': {} })), /already published/);
});

test('fails closed when npm cannot be checked', async () => {
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(checkRegistry(validateRelease(input), names, async () => metadata({}, status)), /Cannot check/);
  }
});

test('stable publishing requires the same RC on every package', async () => {
  const release = { version: '9.0.0', tag: 'latest' };
  await checkRegistry(release, names, async () => metadata({ '9.0.0-rc.1': {} }));
  await assert.rejects(checkRegistry(release, names, async () => metadata({}, 404)), /every package/);
  await assert.rejects(checkRegistry(release, names, async (url) =>
    metadata(url.includes('linux-x64') ? { '9.0.0-rc.1': {} } : { '9.0.0-rc.2': {} })), /every package/);
  await assert.rejects(checkRegistry(release, names, async () => metadata({ '9.0.1-rc.1': {} })), /every package/);
});
