import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorSequenceFromPixels } from './color-sequence.mjs';

const colors = [
  ['red', '#ff0000', [255, 0, 0]],
  ['green', '#00ff00', [0, 255, 0]],
  ['blue', '#0000ff', [0, 0, 255]],
];
const pixels = (...runs) => Buffer.from(runs.flatMap(([rgb, count]) => Array.from({ length: count }, () => rgb).flat()));
const [red, green, blue] = colors.map(([, , rgb]) => rgb);
const black = [0, 0, 0];

test('collapses a color split by a short recording glitch', () => {
  for (const count of [1, 2]) {
    assert.deepEqual(colorSequenceFromPixels(pixels([red, 5], [black, count], [red, 5], [green, 10], [blue, 10]), colors),
      ['red', 'green', 'blue']);
  }
});

test('retains sustained unexpected colors', () => {
  assert.deepEqual(colorSequenceFromPixels(pixels([red, 5], [black, 3], [red, 5], [green, 10], [blue, 10]), colors),
    ['red', 'rgb(0,0,0)', 'red', 'green', 'blue']);
});

test('preserves out-of-order colors and nonadjacent repeats', () => {
  assert.deepEqual(colorSequenceFromPixels(pixels([red, 5], [blue, 5], [red, 5], [green, 5]), colors),
    ['red', 'blue', 'red', 'green']);
});

test('does not combine subthreshold runs into a sustained color', () => {
  assert.deepEqual(colorSequenceFromPixels(pixels([red, 2], [black, 1], [red, 2], [green, 5], [blue, 5]), colors),
    ['green', 'blue']);
});
