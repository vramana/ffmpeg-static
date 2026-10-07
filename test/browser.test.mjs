// End-to-end check of the installed @vramana/ffmpeg package against a real
// browser: Chrome records a video that ffmpeg must understand, and ffmpeg
// encodes videos that Chrome must play back with the right pixels.
//
// Run from a project where @vramana/ffmpeg and puppeteer are installed:
//   node --test browser.test.mjs
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { promisify } from 'node:util';
import puppeteer from 'puppeteer';
import { ffmpegPath, ffprobePath } from '@vramana/ffmpeg';
import { colorSequenceFromPixels, isColor } from './color-sequence.mjs';

const run = promisify(execFile);
const dir = mkdtempSync(path.join(tmpdir(), 'ffmpeg-browser-test-'));

// The test video: one second of each color. In videos ffmpeg encodes, the
// frame at t=i+0.5 must be COLORS[i].
const COLORS = [
  ['red', '#ff0000', [255, 0, 0]],
  ['green', '#00ff00', [0, 255, 0]],
  ['blue', '#0000ff', [0, 0, 255]],
];
const SAMPLE_TIMES = COLORS.map((_, i) => i + 0.5);

const PAGE = `<!doctype html>
<canvas width="320" height="240"></canvas>
<script>
// Paints COLORS on a canvas while MediaRecorder captures it plus a 440 Hz tone,
// then uploads the WebM to the test server.
window.record = async (colors) => {
  const canvas = document.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const audio = new AudioContext();
  await audio.resume();
  const osc = audio.createOscillator();
  const dest = audio.createMediaStreamDestination();
  osc.frequency.value = 440;
  osc.connect(dest);
  osc.start();

  const stream = canvas.captureStream(30);
  stream.addTrack(dest.stream.getAudioTracks()[0]);
  const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  const stopped = new Promise((resolve) => (recorder.onstop = resolve));

  let start = performance.now();
  const paint = () => {
    const i = Math.min(colors.length - 1, Math.floor((performance.now() - start) / 1000));
    ctx.fillStyle = colors[i];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };
  paint();
  const timer = setInterval(paint, 1000 / 60);
  // On slow machines the recorder can take a while to capture its first frame;
  // start the one-second-per-color clock only once it has delivered data.
  recorder.start(250);
  await new Promise((resolve) => recorder.addEventListener('dataavailable', resolve, { once: true }));
  start = performance.now();
  await new Promise((resolve) => setTimeout(resolve, colors.length * 1000 + 200));
  clearInterval(timer);
  recorder.stop();
  await stopped;

  const res = await fetch('/upload', { method: 'POST', body: new Blob(chunks) });
  if (!res.ok) throw new Error('upload failed');
  return mimeType;
};

// Loads a video, seeks to each time and returns the RGB of the center pixel.
window.sample = async (src, times) => {
  const video = document.createElement('video');
  video.muted = true;
  video.src = src;
  await new Promise((resolve, reject) => {
    video.onloadeddata = resolve;
    video.onerror = () => reject(new Error('video error: ' + (video.error && video.error.message)));
  });
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  const pixels = [];
  for (const t of times) {
    video.currentTime = t;
    await new Promise((resolve) => (video.onseeked = resolve));
    // With GPU decoding (macOS) the frame can reach the canvas a little after
    // 'seeked'; until then drawImage leaves it transparent. Redraw until the
    // pixel is opaque. A wrong-colored frame is opaque too, so it still fails.
    let px;
    for (let i = 0; i < 40; i++) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0);
      px = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      if (px[3] === 255) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    pixels.push(Array.from(px.slice(0, 3)));
  }
  return { duration: video.duration, width: video.videoWidth, height: video.videoHeight, pixels };
};
</script>`;

let server;
let origin;
let browser;
let page;
let recording;

// Serves PAGE and files from `dir`, and accepts the recording upload.
before(async () => {
  server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/upload') {
      const body = [];
      req.on('data', (c) => body.push(c));
      req.on('end', () => {
        writeFileSync(path.join(dir, 'chrome.webm'), Buffer.concat(body));
        res.end('ok');
      });
      return;
    }
    if (req.url === '/') {
      res.setHeader('content-type', 'text/html');
      res.end(PAGE);
      return;
    }
    let file;
    try {
      file = readFileSync(path.join(dir, path.basename(req.url)));
    } catch {
      res.writeHead(404).end();
      return;
    }
    // Chrome only seeks in media served with Range support.
    const headers = {
      'content-type': req.url.endsWith('.mp4') ? 'video/mp4' : 'video/webm',
      'accept-ranges': 'bytes',
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (!range) {
      res.writeHead(200, { ...headers, 'content-length': file.length }).end(file);
      return;
    }
    const start = range[1] ? Number(range[1]) : file.length - Number(range[2]);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), file.length - 1) : file.length - 1;
    res.writeHead(206, {
      ...headers,
      'content-range': `bytes ${start}-${end}/${file.length}`,
      'content-length': end - start + 1,
    }).end(file.subarray(start, end + 1));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;

  // --no-sandbox: the browser only loads this local page, and Chrome's sandbox
  // refuses to start as root (containers) or under Ubuntu's AppArmor policy.
  browser = await puppeteer.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  page = await browser.newPage();
  await page.goto(origin);
});

after(async () => {
  await browser?.close();
  server?.close();
});

const probe = async (file) =>
  JSON.parse((await run(ffprobePath, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file])).stdout);

const codecs = async (file) => (await probe(file)).streams.map((s) => s.codec_name);

// The sequence of COLORS a video shows, sampled by ffmpeg at 10 fps (one
// pixel per frame), with repeats collapsed and short blips (codec transitions,
// a late first frame) dropped.
async function colorSequence(file) {
  const { stdout } = await run(
    ffmpegPath,
    ['-v', 'error', '-i', file, '-vf', 'fps=10,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    { encoding: 'buffer', maxBuffer: 1 << 20 },
  );
  return colorSequenceFromPixels(stdout, COLORS);
}

// Chrome's recorder may start late, so only the order of colors is fixed, not their timing.
async function assertColorSequence(file, where) {
  assert.deepEqual(await colorSequence(file), COLORS.map(([name]) => name), `${where}: colors`);
}

function assertColor(actual, [name, , expected], where) {
  assert.ok(isColor(actual, expected), `${where}: expected ${name} ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

test('ffprobe reads a WebM recorded by Chrome', async () => {
  const mimeType = await page.evaluate((c) => window.record(c), COLORS.map(([, css]) => css));
  recording = path.join(dir, 'chrome.webm');
  console.log(`Chrome recorded ${mimeType}`);

  const streams = (await probe(recording)).streams;
  assert.match(streams.find((s) => s.codec_type === 'video').codec_name, /^vp[89]$/);
  assert.equal(streams.find((s) => s.codec_type === 'audio').codec_name, 'opus');

  const { stdout } = await run(ffprobePath, ['-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=nb_read_frames,width,height', '-of', 'json', recording]);
  const video = JSON.parse(stdout).streams[0];
  assert.deepEqual([video.width, video.height], [320, 240]);
  assert.ok(Number(video.nb_read_frames) >= 30, `only ${video.nb_read_frames} frames decoded`);
});

test('ffmpeg extracts frames with the colors Chrome painted', async () => {
  await assertColorSequence(recording, 'chrome.webm');

  await run(ffmpegPath, ['-v', 'error', '-i', recording, '-vf', 'fps=1', path.join(dir, 'thumb-%d.png')]);
  const thumbs = readdirSync(dir).filter((f) => f.startsWith('thumb-'));
  assert.ok(thumbs.length >= COLORS.length, `only ${thumbs.length} thumbnails`);
  for (const f of thumbs) {
    assert.deepEqual([...readFileSync(path.join(dir, f)).subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], `${f} is not a PNG`);
  }
});

test('ffmpeg transcodes the recording with every bundled encoder', async () => {
  const outputs = [
    ['h264.mp4', ['-c:v', 'libx264', '-c:a', 'aac'], ['h264', 'aac']],
    ['hevc.mp4', ['-c:v', 'libx265', '-c:a', 'aac'], ['hevc', 'aac']],
    ['vp9.webm', ['-c:v', 'libvpx-vp9', '-c:a', 'libopus'], ['vp9', 'opus']],
    ['audio.mp3', ['-vn', '-c:a', 'libmp3lame'], ['mp3']],
  ];
  for (const [name, args, expected] of outputs) {
    const out = path.join(dir, name);
    await run(ffmpegPath, ['-v', 'error', '-y', '-i', recording, ...args, out]);
    assert.deepEqual(await codecs(out), expected, name);
    if (expected.length > 1) await assertColorSequence(out, name);
  }
});

// Encodes the color sequence from scratch (no browser involved) with a tone.
async function encodeColors(name, args) {
  const graph = COLORS.map(([, css], i) => `color=c=0x${css.slice(1)}:s=320x240:r=30:d=1[c${i}]`).join(';') +
    `;${COLORS.map((_, i) => `[c${i}]`).join('')}concat=n=${COLORS.length}:v=1:a=0,format=yuv420p[v]`;
  const out = path.join(dir, name);
  await run(ffmpegPath, ['-v', 'error', '-y', '-filter_complex', graph,
    '-f', 'lavfi', '-i', `sine=frequency=440:duration=${COLORS.length}`,
    '-map', '[v]', '-map', '0:a', ...args, out]);
  return out;
}

async function assertChromePlays(name) {
  const result = await page.evaluate((src, times) => window.sample(src, times), `${origin}/${name}`, SAMPLE_TIMES);
  assert.deepEqual([result.width, result.height], [320, 240]);
  assert.ok(Math.abs(result.duration - COLORS.length) < 0.2, `duration ${result.duration}`);
  result.pixels.forEach((px, i) => assertColor(px, COLORS[i], `Chrome playing ${name} @${SAMPLE_TIMES[i]}s`));
}

test('Chrome plays a VP9/Opus WebM encoded by ffmpeg', async () => {
  await encodeColors('ffmpeg-vp9.webm', ['-c:v', 'libvpx-vp9', '-c:a', 'libopus']);
  await assertChromePlays('ffmpeg-vp9.webm');
});

test('Chrome plays an H.264/AAC MP4 encoded by ffmpeg', async (t) => {
  const h264 = await page.evaluate(() => document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"'));
  if (!h264) return t.skip('this Chrome build has no H.264 support');
  await encodeColors('ffmpeg-h264.mp4', ['-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart']);
  await assertChromePlays('ffmpeg-h264.mp4');
});
