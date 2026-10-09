'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { trainingPlan, rewardsAt, packageSummary, comparePackages } = require('../js/foundation-40-math.js');
const { event, items, offers, packages } = require('../data/foundation-40/explorer.json');
const input = overrides => ({ tier: 10, from: 0, amount: 0, minutes: 0, current: 0, target: 300000, ...overrides });

test('zero activity preserves existing score and produces finite alternatives', () => {
  const p = trainingPlan(event, input({ current: 1000, target: 50000 }));
  assert.deepEqual(p, { rate: 40, planned: 0, total: 1000, remaining: 49000, additionalTroops: 1225, additionalMinutes: 1167 });
  assert.deepEqual(trainingPlan(event, input({ target: 0 })), { rate: 40, planned: 0, total: 0, remaining: 0, additionalTroops: 0, additionalMinutes: 0 });
});
test('promotion uses the tier difference and does not recount previously earned training points', () => {
  const first = trainingPlan(event, input({ tier: 9, amount: 100, target: 5000 }));
  assert.equal(first.total, 3500);
  const promoted = trainingPlan(event, input({ from: 9, amount: 100, current: first.total, target: 5000 }));
  assert.equal(promoted.rate, 5); assert.equal(promoted.planned, 500); assert.equal(promoted.total, 4000);
  const unchanged = trainingPlan(event, input({ from: 9, amount: 0, current: promoted.total, target: 5000 }));
  assert.equal(unchanged.total, 4000);
});
test('new actions and current points are counted once; alternatives round upward separately', () => {
  const p = trainingPlan(event, input({ from: 9, amount: 100, minutes: 10, current: 1000, target: 5000 }));
  assert.equal(p.planned, 920); assert.equal(p.total, 1920); assert.equal(p.remaining, 3080);
  assert.equal(p.additionalTroops, 616); assert.equal(p.additionalMinutes, 74);
  assert.ok(p.total + p.additionalTroops * 5 >= 5000);
  assert.ok(p.total + (p.additionalTroops - 1) * 5 < 5000);
  assert.ok(p.total + p.additionalMinutes * 42 >= 5000);
  assert.ok(p.total + (p.additionalMinutes - 1) * 42 < 5000);
});
test('exact and exceeded targets never produce negative remaining activity', () => {
  for (const current of [300000, 300001]) {
    const p = trainingPlan(event, input({ current }));
    assert.equal(p.remaining, 0); assert.equal(p.additionalTroops, 0); assert.equal(p.additionalMinutes, 0);
  }
  assert.equal(trainingPlan(event, input({ tier: 1, amount: 12500, target: 50000 })).remaining, 0);
});
test('invalid order, negative, fractional, missing, nonfinite and out-of-range inputs fail', () => {
  for (const bad of [{ tier: 0 }, { tier: 11 }, { tier: 5, from: 5 }, { tier: 5, from: 6 }, { amount: -1 }, { minutes: 0.5 }, { amount: '' }, { amount: undefined }, { amount: Infinity }, { current: NaN }, { target: 1000000001 }]) {
    assert.throws(() => trainingPlan(event, input(bad)), RangeError, JSON.stringify(bad));
  }
});
test('maximum accepted integer inputs remain exactly representable', () => {
  const p = trainingPlan(event, input({ amount: 1000000000, minutes: 1000000000, current: 1000000000, target: 1000000000 }));
  assert.equal(p.planned, 82000000000); assert.equal(p.total, 83000000000);
  assert.equal(p.remaining, 0); assert.ok(Number.isSafeInteger(p.total));
});
test('reward thresholds include the exact boundary, with no future-stage reward', () => {
  assert.deepEqual(rewardsAt(event.stages, 0), {});
  assert.deepEqual(rewardsAt(event.stages, 49999), {});
  assert.equal(rewardsAt(event.stages, 50000)['arms-medal'], 1);
  assert.equal(rewardsAt(event.stages, 149999)['arms-medal'], 1);
  assert.equal(rewardsAt(event.stages, 150000)['arms-medal'], 3);
  assert.equal(rewardsAt(event.stages, 299999)['arms-medal'], 3);
  assert.equal(rewardsAt(event.stages, 300000)['arms-medal'], 6);
});
test('three screenshot reward bundles add quantities, without multiplying item quantity by denomination twice', () => {
  const totals = rewardsAt(event.stages, 300000);
  assert.deepEqual(totals, { 'hero-skill-book': 40, 'arms-medal': 6, 'food-10k': 60, 'wood-10k': 60, 'metal-10k': 60, 'speedup-5m': 50 });
  for (const id of ['food-10k', 'wood-10k', 'metal-10k']) assert.equal(totals[id] * items.find(item => item.id === id).resourceAmount, 600000);
  assert.equal(totals['speedup-5m'] * items.find(item => item.id === 'speedup-5m').minutes, 250);
});
test('VIP exchange offers retain unit quantities and do not treat remaining purchases as bundle quantity', () => {
  assert.deepEqual(offers.map(o => [o.item, o.quantity, o.cost, o.currency]), [['food-100k', 1, 20, 'diamonds'], ['speedup-5m', 1, 60, 'diamonds']]);
  assert.equal(items.find(item => item.id === 'food-100k').resourceAmount, 100000);
});
test('calculation does not mutate the source event or input', () => {
  const before = JSON.stringify(event), original = input({ amount: 5, minutes: 7, current: 9 }), text = JSON.stringify(original);
  trainingPlan(event, original); rewardsAt(event.stages, 300000);
  assert.equal(JSON.stringify(event), before); assert.equal(JSON.stringify(original), text);
});
test('six captured offers preserve displayed base, bonus, total, coin cost and literal limit', () => {
  assert.equal(packages.length, 6);
  assert.deepEqual(packages.map(p => { const s = packageSummary(p); return [s.baseDiamonds, s.bonusDiamonds, s.totalDiamonds, s.coinCost, s.condition]; }), [
    [500, 0, 500, 99, 'not-shown'], [2500, 0, 2500, 499, 'not-shown'], [5000, 0, 5000, 999, 'not-shown'],
    [10000, 10000, 20000, 1999, 'one-time-purchase'], [25000, 25000, 50000, 4999, 'one-time-purchase'], [50000, 50000, 100000, 9999, 'one-time-purchase']
  ]);
  assert.ok(packages.every(p => p.currency === 'exploration-coin'));
  assert.ok(packages.slice(0, 3).every(p => p.bonusDisplay === 'not-shown'));
});
test('coin comparisons include each displayed bonus once and retain its condition', () => {
  const result = comparePackages(packages[0], packages[3]);
  assert.equal(result.a.diamondsPerCoin, 500 / 99);
  assert.equal(result.b.diamondsPerCoin, 20000 / 1999);
  assert.equal(result.b.totalDiamonds, 20000);
  assert.equal(result.b.condition, 'one-time-purchase');
  assert.equal(result.ratioComparison, -1);
  assert.equal(comparePackages(packages[3], packages[0]).ratioComparison, 1);
});
test('same-offer and exact equal-ratio comparisons are ties', () => {
  assert.equal(comparePackages(packages[0], packages[0]).ratioComparison, 0);
  const a = { ...packages[0], coinCost: 100 }, b = { ...packages[0], baseDiamonds: 1000, coinCost: 200 };
  assert.equal(comparePackages(a, b).ratioComparison, 0);
});
test('different coin or fiat currencies cannot be compared', () => {
  for (const currency of ['another-coin', 'KRW', 'USD']) assert.throws(() => comparePackages(packages[0], { ...packages[1], currency }), /currency mismatch/);
});
test('invalid package values cannot create infinite, negative or imprecise totals', () => {
  for (const override of [{ coinCost: 0 }, { coinCost: -1 }, { coinCost: Infinity }, { coinCost: '99' }, { baseDiamonds: 0 }, { bonusDiamonds: -1 }, { bonusDiamonds: 0.5 }, { bonusDiamonds: null }, { baseDiamonds: Number.MAX_SAFE_INTEGER, bonusDiamonds: 1 }, { currency: '' }]) assert.throws(() => packageSummary({ ...packages[0], ...override }), RangeError);
  assert.throws(() => comparePackages(undefined, packages[0]), RangeError);
});
test('ratio ordering uses exact integers even when displayed floating values round alike', () => {
  const max = Number.MAX_SAFE_INTEGER;
  const a = { ...packages[0], baseDiamonds: max, coinCost: max - 1 }, b = { ...packages[0], baseDiamonds: max - 1, coinCost: max - 2 };
  const result = comparePackages(a, b);
  assert.equal(result.ratioComparison, -1);
});
test('package calculations preserve curated source objects and do not invent eligibility', () => {
  const before = JSON.stringify(packages);
  const result = comparePackages(packages[0], packages[5]);
  assert.equal(JSON.stringify(packages), before);
  assert.equal(Object.hasOwn(result, 'canPurchase'), false);
  assert.equal(Object.hasOwn(result, 'cashPrice'), false);
});
