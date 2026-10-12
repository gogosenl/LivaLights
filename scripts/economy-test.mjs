const layers = [
  { count: 50, cost: 0 },
  { count: 50, cost: 15 },
  { count: 50, cost: 20 },
  { count: 50, cost: 25 },
  { count: 50, cost: 30 },
  { count: 50, cost: 35 },
  { count: 50, cost: 40 },
  { count: 50, cost: 42 },
  { count: 50, cost: 45 },
  { count: 50, cost: 48 }
];
for (let i = 1; i < layers.length; i += 1) {
  const earned = layers[i - 1].count;
  if (layers[i].cost > earned) throw new Error(`Layer ${i + 1} cannot be unlocked: cost ${layers[i].cost}, earned ${earned}`);
}
console.log('Economy test passed: every layer can be unlocked without a purchase.');
