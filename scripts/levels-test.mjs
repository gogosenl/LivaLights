import fs from 'node:fs';

const configSource = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
const configUrl = `data:text/javascript;base64,${Buffer.from(configSource).toString('base64')}`;
const gameSource = fs.readFileSync(new URL('../src/game.js', import.meta.url), 'utf8').replace("from './config'", `from '${configUrl}'`);
const gameUrl = `data:text/javascript;base64,${Buffer.from(gameSource).toString('base64')}`;
const [{ TOTAL_LEVELS, shouldShowInterstitial }, { createLevel, isSolved }] = await Promise.all([import(configUrl), import(gameUrl)]);

if (TOTAL_LEVELS !== 1000) throw new Error(`Expected 1000 levels, found ${TOTAL_LEVELS}`);
for (let completed = 1; completed <= 25; completed += 1) {
  const expected = [13, 16, 19, 22, 25].includes(completed);
  if (shouldShowInterstitial(completed - 1, completed, false, false) !== expected) throw new Error(`Unexpected interstitial rule at completion ${completed}.`);
}
if (shouldShowInterstitial(12, 13, true, false)) throw new Error('Replayed levels must not show an interstitial.');
if (shouldShowInterstitial(12, 13, false, true)) throw new Error('Ad-free users must not show an interstitial.');

const shapes = new Map();
const dimensions = new Map();
for (let index = 0; index < TOTAL_LEVELS; index += 1) {
  const level = createLevel(index);
  if (!isSolved(level, level.solution)) throw new Error(`Level ${index + 1} is not solvable by its generated solution.`);
  if (index < 8 && (level.rows !== 3 || level.cols !== 3)) throw new Error(`Level ${index + 1} must be 3x3.`);
  if (index >= 8 && index < 20 && (level.rows !== 4 || level.cols !== 4)) throw new Error(`Level ${index + 1} must be 4x4.`);
  if (index >= 20 && (level.rows < 5 || level.cols < 5)) throw new Error(`Level ${index + 1} must be at least 5x5.`);
  const playable = level.rows * level.cols - level.voids.size - level.rocks.size;
  if (playable < level.lampCount) throw new Error(`Level ${index + 1} does not have enough playable cells.`);
  shapes.set(level.shape, (shapes.get(level.shape) || 0) + 1);
  const dimension = `${level.rows}x${level.cols}`;
  dimensions.set(dimension, (dimensions.get(dimension) || 0) + 1);
}

console.log(`Verified ${TOTAL_LEVELS} solvable levels.`);
console.log('Shapes:', Object.fromEntries(shapes));
console.log('Dimensions:', Object.fromEntries(dimensions));
