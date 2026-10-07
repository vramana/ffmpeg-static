// Lossy codecs and color conversion shift values a little.
export const isColor = (actual, expected) => actual.every((v, i) => Math.abs(v - expected[i]) <= 40);

// Collapse repeated colors, discard short codec/startup blips, then collapse
// again: removing a blip can leave two runs of the same color next to each other.
export function colorSequenceFromPixels(pixels, colors) {
  const runs = [];
  for (let i = 0; i + 3 <= pixels.length; i += 3) {
    const px = [...pixels.subarray(i, i + 3)];
    const match = colors.find(([, , rgb]) => isColor(px, rgb));
    const name = match ? match[0] : `rgb(${px})`;
    if (runs.at(-1)?.name === name) runs.at(-1).frames++;
    else runs.push({ name, frames: 1 });
  }
  const sequence = [];
  for (const { name, frames } of runs) {
    if (frames >= 3 && sequence.at(-1) !== name) sequence.push(name);
  }
  return sequence;
}
