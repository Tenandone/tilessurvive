(function (root) {
  "use strict";
  function amount(raw) {
    const s = String(raw).trim().replace(/,/g, "");
    const m = s.match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i);
    if (!m) return null;
    return Math.round(
      Number(m[1]) *
        ({ K: 1e3, M: 1e6, B: 1e9 }[String(m[2]).toUpperCase()] || 1),
    );
  }
  function minutes(raw) {
    let s = String(raw).trim();
    if (!s || s === "-") return null;
    let total = 0,
      found = false;
    const re =
      /(\d+)\s*(일|시간|분|days?|hours?|hrs?|minutes?|mins?|d|h|m|天|小時|分鐘|日|時間|分|дн\.?|д\.?|ч\.?|мин\.?)/gi;
    s = s.replace(re, (_, n, u) => {
      found = true;
      u = u.toLowerCase();
      total +=
        Number(n) *
        (/^(일|days?|d|天|日|дн\.?|д\.?)$/.test(u)
          ? 1440
          : /^(시간|hours?|hrs?|h|小時|時間|ч\.?)$/.test(u)
            ? 60
            : 1);
      return "";
    });
    return found && !s.trim() ? total : null;
  }
  function sumRange(rows, current, target, columns, timeColumn) {
    if (
      !Number.isInteger(current) ||
      !Number.isInteger(target) ||
      current > target
    )
      throw new Error("range");
    const selected = rows.filter((r) => r.level > current && r.level <= target);
    if (selected.length !== target - current) throw new Error("missing");
    const totals = columns.map(() => 0);
    let time = 0;
    for (const r of selected) {
      columns.forEach((col, i) => {
        const n = amount(r.cells[col]);
        if (n === null) throw new Error("unknown");
        totals[i] += n;
      });
      if (timeColumn >= 0) {
        const n = minutes(r.cells[timeColumn]);
        if (n === null) throw new Error("unknown");
        time += n;
      }
    }
    return { totals, time, levels: selected.map((r) => r.level) };
  }
  const api = { amount, minutes, sumRange };
  if (typeof module === "object") module.exports = api;
  else root.TS_MATH = api;
})(typeof window === "object" ? window : globalThis);
