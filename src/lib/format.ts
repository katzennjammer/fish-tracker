// Money is stored as whole centavos so sums never drift.

export function toCents(pesos: number): number {
  return Math.round(pesos * 100);
}

export function parseAmount(text: string): number | null {
  const clean = text.replace(/[,\s₱]/g, '');
  if (clean === '' || clean === '.') return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** "1,250.50" — no symbol, used next to a separate ₱ glyph. */
export function money(cents: number, opts: { decimals?: boolean } = {}): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const showFrac = opts.decimals ?? frac !== 0;
  const s = whole.toLocaleString('en-US') + (showFrac ? '.' + String(frac).padStart(2, '0') : '');
  return (neg ? '−' : '') + s;
}

/** "₱1,250.50" */
export function peso(cents: number): string {
  const s = money(cents);
  return s.startsWith('−') ? '−₱' + s.slice(1) : '₱' + s;
}

export function kg(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' kg';
}

/** Price fields show pesos without trailing ".00". */
export function centsToInput(cents: number): string {
  if (!cents) return '';
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
