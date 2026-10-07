// Validates the manual release inputs and checks npm before building/publishing.
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function validateRelease({ version, ffmpegVersion, ref, verifiedRc }) {
  if (ref !== 'refs/heads/main') throw new Error('Run releases from the main branch.');
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.([1-9]\d*))?$/.exec(version);
  if (!match) throw new Error('Use a version such as 9.0.0-rc.1 or 9.0.0.');
  if (match[1] !== ffmpegVersion.split('.')[0]) throw new Error('The npm major version must match the FFmpeg major version.');
  const tag = match[4] ? 'rc' : 'latest';
  if (tag === 'latest' && verifiedRc !== 'true') throw new Error('Verify a release candidate first, then check the RC verification box.');
  return { version, tag };
}

export async function checkRegistry({ version, tag }, names, fetchMetadata = fetch) {
  const releases = [];
  for (const name of names) {
    const response = await fetchMetadata(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (!response.ok && response.status !== 404) throw new Error(`Cannot check ${name}: npm returned HTTP ${response.status}.`);
    const versions = response.status === 404 ? {} : (await response.json()).versions ?? {};
    if (Object.hasOwn(versions, version)) throw new Error(`${name}@${version} is already published. Choose a new version.`);
    releases.push(Object.keys(versions));
  }
  if (tag === 'latest') {
    const candidates = releases[0].filter((v) => v.startsWith(`${version}-rc.`));
    if (!candidates.some((v) => releases.every((versions) => versions.includes(v)))) {
      throw new Error(`Publish and verify the same ${version}-rc.N on every package before publishing ${version}.`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pins = readFileSync(new URL('../versions.sh', import.meta.url), 'utf8');
  const ffmpegVersion = /^FFMPEG_VERSION=(\S+)$/m.exec(pins)?.[1];
  if (!ffmpegVersion) throw new Error('Cannot read FFMPEG_VERSION from versions.sh.');
  const release = validateRelease({
    version: process.env.RELEASE_VERSION,
    ffmpegVersion,
    ref: process.env.GITHUB_REF,
    verifiedRc: process.env.RC_VERIFIED,
  });
  const main = JSON.parse(readFileSync(new URL('../npm/ffmpeg/package.json', import.meta.url), 'utf8'));
  await checkRegistry(release, [...Object.keys(main.optionalDependencies), main.name]);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${release.version}\ntag=${release.tag}\n`);
  console.log(`Ready to release ${release.version} under the ${release.tag} tag.`);
}
