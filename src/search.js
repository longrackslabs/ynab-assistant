import { performance } from 'node:perf_hooks';
import { exact } from './money.js';

export function findSubsets(amounts, target, limits) {
  if (target === 0) return {masks: [], complete: false, truncated: false, reason: 'already_balanced_no_search', operations: 0};
  const deadline = performance.now() + limits.max_milliseconds;
  const keep = limits.max_candidates + 1;
  const found = new Set(); let truncated = false;
  const remember = mask => {
    if (found.has(mask)) return;
    if (found.size < keep) found.add(mask); else truncated = true;
  };
  const prior = new Map();
  for (let i = 0; i < amounts.length; i++) {
    if (amounts[i] === target) remember(1n << BigInt(i));
    for (const j of (prior.get(target - amounts[i]) ?? []).slice(0, keep)) remember((1n << BigInt(i)) | (1n << BigInt(j)));
    const bucket = prior.get(amounts[i]) ?? [];
    if (bucket.length < keep) bucket.push(i);
    prior.set(amounts[i], bucket);
  }
  const negatives = Array(amounts.length + 1).fill(0), positives = [...negatives];
  for (let i = amounts.length - 1; i >= 0; i--) {
    negatives[i] = exact(negatives[i + 1] + Math.min(0, amounts[i]));
    positives[i] = exact(positives[i + 1] + Math.max(0, amounts[i]));
  }
  let states = new Map([[0, [0n]]]), operations = 0, reason = null;
  outer: for (let i = 0; i < amounts.length; i++) {
    const next = new Map();
    for (const [subtotal, paths] of states) {
      for (const include of [false, true]) {
        if (++operations > limits.max_operations) { reason = 'operation_limit'; break outer; }
        if (operations % 256 === 0 && performance.now() > deadline) { reason = 'time_limit'; break outer; }
        const total = include ? exact(subtotal + amounts[i]) : subtotal;
        if (total + negatives[i + 1] > target || total + positives[i + 1] < target) continue;
        if (!next.has(total)) {
          if (next.size >= limits.max_states) { reason = 'state_limit'; break outer; }
          next.set(total, []);
        }
        const bucket = next.get(total);
        for (const path of paths) {
          const candidate = include ? path | (1n << BigInt(i)) : path;
          if (bucket.includes(candidate)) continue;
          if (total === target) remember(candidate);
          if (bucket.length < keep) bucket.push(candidate); else truncated = true;
        }
      }
    }
    states = next;
  }
  const countBits = mask => { let n = 0; for (let x = mask; x; x &= x - 1n) n++; return n; };
  const masks = [...found].sort((a, b) => countBits(a) - countBits(b) || (a < b ? -1 : a > b ? 1 : 0));
  return {masks: masks.slice(0, limits.max_candidates), complete: reason === null,
    truncated: truncated || masks.length > limits.max_candidates, reason, operations};
}
