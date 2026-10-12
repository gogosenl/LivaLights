import { layerIndexFor } from './config';

const key = (row, col) => `${row},${col}`;

function seededRandom(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = value + Math.imul(value ^ (value >>> 7), 61 | value) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function dimensionsFor(index) {
  if (index < 8) return { rows: 3, cols: 3 };
  if (index < 20) return { rows: 4, cols: 4 };
  if (index < 60) return { rows: 5, cols: 5 };
  if (index < 100) return index % 2 ? { rows: 5, cols: 6 } : { rows: 6, cols: 5 };
  if (index < 180) return [{ rows: 5, cols: 6 }, { rows: 6, cols: 5 }, { rows: 6, cols: 6 }][index % 3];
  if (index < 300) return [{ rows: 6, cols: 6 }, { rows: 6, cols: 7 }, { rows: 7, cols: 6 }][index % 3];
  return [{ rows: 6, cols: 7 }, { rows: 7, cols: 6 }, { rows: 7, cols: 7 }, { rows: 5, cols: 7 }, { rows: 7, cols: 5 }][index % 5];
}

function shapeFor(index) {
  if (index < 30) return 'full';
  const shapes = ['full', 'notches', 'l', 'cross', 'diamond', 'terraces'];
  return shapes[(index * 7 + Math.floor(index / 10)) % shapes.length];
}

function voidCells(rows, cols, shape) {
  const voids = new Set();
  if (shape === 'notches') {
    [[0, 0], [0, cols - 1], [rows - 1, 0], [rows - 1, cols - 1]].forEach(([r, c]) => voids.add(key(r, c)));
  } else if (shape === 'l') {
    const cutRows = Math.max(1, Math.floor(rows / 3));
    const cutCols = Math.max(1, Math.floor(cols / 3));
    for (let r = 0; r < cutRows; r += 1) for (let c = cols - cutCols; c < cols; c += 1) voids.add(key(r, c));
  } else if (shape === 'cross') {
    const armRow = Math.floor(rows / 2);
    const armCol = Math.floor(cols / 2);
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
      if (Math.abs(r - armRow) > 1 && Math.abs(c - armCol) > 1) voids.add(key(r, c));
    }
  } else if (shape === 'diamond') {
    const centerRow = (rows - 1) / 2;
    const centerCol = (cols - 1) / 2;
    const limit = Math.max(2, Math.floor((Math.min(rows, cols) - 1) / 2) + 1);
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
      if (Math.abs(r - centerRow) + Math.abs(c - centerCol) > limit) voids.add(key(r, c));
    }
  } else if (shape === 'terraces') {
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
      if ((r === 0 && c >= cols - 2) || (r === rows - 1 && c < 2) || (r === 1 && c === cols - 1) || (r === rows - 2 && c === 0)) voids.add(key(r, c));
    }
  }
  return voids;
}

export function litCells(rows, cols, blocked, lamps) {
  const lit = new Set();
  lamps.forEach((lamp) => {
    const [row, col] = lamp.split(',').map(Number);
    [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => {
      const r = row + dr;
      const c = col + dc;
      const cell = key(r, c);
      if (r >= 0 && r < rows && c >= 0 && c < cols && !blocked.has(cell)) lit.add(cell);
    });
  });
  return lit;
}

export function lineCounts(rows, cols, lit) {
  const rowCounts = Array(rows).fill(0);
  const colCounts = Array(cols).fill(0);
  lit.forEach((cell) => {
    const [row, col] = cell.split(',').map(Number);
    rowCounts[row] += 1;
    colCounts[col] += 1;
  });
  return { rows: rowCounts, cols: colCounts };
}

export function createLevel(index) {
  const layer = layerIndexFor(index);
  const { rows, cols } = dimensionsFor(index);
  const shape = shapeFor(index);
  const voids = voidCells(rows, cols, shape);
  const random = seededRandom(9137 + index * 7919);
  const playable = [];
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < cols; col += 1) {
    const cell = key(row, col);
    if (!voids.has(cell)) playable.push(cell);
  }
  const rockCount = index < 20 ? 0 : Math.min(6, Math.floor(index / 90) + (index % 23 === 0 ? 1 : 0));
  const ordered = shuffled(playable, random);
  const rocks = new Set(ordered.slice(0, Math.min(rockCount, Math.max(0, playable.length - 5))));
  const candidates = shuffled(playable.filter((cell) => !rocks.has(cell)), random);
  const beginnerLamps = index < 3 ? 1 : index < 8 ? 2 : index < 14 ? 2 : 3;
  const advancedLamps = 3 + Math.floor((index % 50) / 12) + Math.floor(layer / 3);
  const lampCount = Math.min(8, Math.max(1, index < 20 ? beginnerLamps : advancedLamps), candidates.length);
  const solution = new Set(candidates.slice(0, lampCount));
  const blocked = new Set([...voids, ...rocks]);
  const target = lineCounts(rows, cols, litCells(rows, cols, blocked, solution));
  return { index, rows, cols, shape, lampCount, rocks, voids, solution, target };
}

export function isSolved(level, lamps) {
  if (lamps.size !== level.lampCount) return false;
  const blocked = new Set([...level.voids, ...level.rocks]);
  const counts = lineCounts(level.rows, level.cols, litCells(level.rows, level.cols, blocked, lamps));
  return counts.rows.every((value, i) => value === level.target.rows[i]) && counts.cols.every((value, i) => value === level.target.cols[i]);
}

export function starsFor(moves, lampCount) {
  const optimalMoves = Math.max(1, lampCount);
  if (moves <= optimalMoves + 2) return 3;
  if (moves <= optimalMoves + 5) return 2;
  return 1;
}
