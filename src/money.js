export function exact(value) {
  if (!Number.isSafeInteger(value)) throw new Error('Amount exceeds safe integer milliunits');
  return value;
}
export function sum(values) { return values.reduce((total, value) => exact(total + value), 0); }
export function parseMoney(input) {
  if (!/^[+-]?\d+(?:\.\d{1,3})?$/.test(input) || input.length > 40) {
    throw new Error('Use a plain decimal balance with at most three decimal places');
  }
  const negative = input.startsWith('-');
  const [whole, fraction = ''] = input.replace(/^[+-]/, '').split('.');
  const value = BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount exceeds safe integer milliunits');
  return exact(Number(negative ? -value : value));
}
export function displayMoney(input) {
  exact(input);
  const value = BigInt(input);
  const absolute = value < 0n ? -value : value;
  const fraction = String(absolute % 1000n).padStart(3, '0').replace(/0+$/, '');
  return `${value < 0n ? '-' : ''}${absolute / 1000n}${fraction ? '.' + fraction : ''}`;
}
export function digitSwap(first, second, decimalDigits = 2) {
  const scale = 10 ** (3 - decimalDigits);
  if (!first || !second || Math.sign(first) !== Math.sign(second) || first % scale || second % scale) return false;
  let a = String(Math.abs(first) / scale), b = String(Math.abs(second) / scale);
  const width = Math.max(a.length, b.length, decimalDigits + 1);
  a = a.padStart(width, '0'); b = b.padStart(width, '0');
  const differences = [...a].flatMap((digit, i) => digit !== b[i] ? [i] : []);
  return differences.length === 2 && a[differences[0]] === b[differences[1]] && a[differences[1]] === b[differences[0]];
}
