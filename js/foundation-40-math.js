/* Game-screen-scoped calculations. No estimated prices or resource conversion. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TSFoundationMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function integer(value, name, max = 1000000000) {
    const n = Number(value);
    if (value === '' || !Number.isSafeInteger(n) || n < 0 || n > max) throw new RangeError(name);
    return n;
  }
  function trainingPlan(data, input) {
    const tier = integer(input.tier, 'tier', 10), from = integer(input.from, 'from', 10);
    if (tier < 1 || (from !== 0 && from >= tier)) throw new RangeError('tier order');
    const amount = integer(input.amount, 'amount'), minutes = integer(input.minutes, 'minutes');
    const current = integer(input.current, 'current'), target = integer(input.target, 'target');
    const rate = data.troopPoints[tier - 1] - (from === 0 ? 0 : data.troopPoints[from - 1]);
    if (!Number.isSafeInteger(rate) || rate <= 0) throw new RangeError('rate');
    const planned = amount * rate + minutes * data.pointsPerSpeedupMinute;
    const total = current + planned;
    if (!Number.isSafeInteger(total)) throw new RangeError('total');
    const remaining = Math.max(0, target - total);
    return { rate, planned, total, remaining, additionalTroops: Math.ceil(remaining / rate), additionalMinutes: Math.ceil(remaining / data.pointsPerSpeedupMinute) };
  }
  function rewardsAt(stages, score) {
    integer(score, 'score');
    const totals = {};
    for (const stage of stages) if (score >= stage.points) {
      for (const reward of stage.rewards) {
        integer(reward.quantity, 'reward');
        totals[reward.item] = (totals[reward.item] || 0) + reward.quantity;
      }
    }
    return totals;
  }
  function packageSummary(offer) {
    if (!offer || typeof offer.currency !== 'string' || !offer.currency.length) throw new RangeError('package currency');
    for (const key of ['baseDiamonds', 'bonusDiamonds', 'coinCost']) {
      if (typeof offer[key] !== 'number' || !Number.isSafeInteger(offer[key]) || offer[key] < 0) throw new RangeError('package ' + key);
    }
    if (!offer.coinCost || !offer.baseDiamonds) throw new RangeError('package amount');
    const totalDiamonds = offer.baseDiamonds + offer.bonusDiamonds;
    if (!Number.isSafeInteger(totalDiamonds)) throw new RangeError('package total');
    return { id: offer.id, baseDiamonds: offer.baseDiamonds, bonusDiamonds: offer.bonusDiamonds, totalDiamonds, coinCost: offer.coinCost, currency: offer.currency, condition: offer.condition, diamondsPerCoin: totalDiamonds / offer.coinCost };
  }
  function comparePackages(first, second) {
    const a = packageSummary(first), b = packageSummary(second);
    if (a.currency !== b.currency) throw new RangeError('package currency mismatch');
    // Rank the exact integer ratios without relying on rounded display values.
    const left = BigInt(a.totalDiamonds) * BigInt(b.coinCost), right = BigInt(b.totalDiamonds) * BigInt(a.coinCost);
    return { a, b, ratioComparison: left === right ? 0 : left > right ? 1 : -1 };
  }
  return { trainingPlan, rewardsAt, packageSummary, comparePackages };
});
