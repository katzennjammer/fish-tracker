import type { LedgerEntry, PersonSummary } from './db';
import { kg, peso } from './format';
import { short, today } from './dates';

// What a statement says, kept apart from how the card is drawn so the
// picture and the text version can never disagree.

/**
 * What the statement covers. Opened from a day picked in the calendar it starts as that day alone;
 * the other two add the balance still left, or go back to the whole account.
 */
export type Scope = 'day' | 'dayBalance' | 'all';

/** How many entries the whole-account statement lists, as a picture and as text. */
export const CARD_ROWS = 8;
export const TEXT_ROWS = 12;

/** A day from the route is only used if it is a real date with records on it. */
export function statementDay(day: unknown, ledger: LedgerEntry[]): string | null {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return ledger.some((e) => e.date === day) ? day : null;
}

/** The entries of one day, oldest first like the ledger itself. */
export function dayEntries(ledger: LedgerEntry[], day: string): LedgerEntry[] {
  return ledger.filter((e) => e.date === day);
}

/**
 * One day in two figures: the full value of what was taken, and everything paid that day —
 * money handed over with the goods as well as payments towards older utang.
 */
export function dayTotals(entries: LedgerEntry[]): { taken: number; paid: number } {
  let taken = 0;
  let paid = 0;
  for (const e of entries) {
    if (e.kind === 'payment') paid += e.total;
    else {
      taken += e.total;
      paid += e.paid;
    }
  }
  return { taken, paid };
}

export function statementText(p: PersonSummary, ledger: LedgerEntry[], stall: string, scope: Scope, day: string | null): string {
  const oneDay = scope !== 'all' && day !== null;
  const entries = oneDay ? dayEntries(ledger, day) : ledger.slice(-TEXT_ROWS);
  const lines = entries.map((e) =>
    e.kind === 'payment'
      ? `${short(e.date)}  Paid  −${peso(e.total)}`
      : e.kind === 'balance'
        ? `${short(e.date)}  ${e.balance_kind === 'old' ? 'Old balance' : 'Utang'}  ${peso(e.total)}`
        : `${short(e.date)}  ${e.fish} ${kg(e.kg ?? 0)} × ${peso(e.price ?? 0)} = ${peso(e.total)}${e.paid ? ` (paid ${peso(e.paid)})` : ''}`,
  );
  const summary: string[] = [];
  if (oneDay) {
    const { taken, paid } = dayTotals(entries);
    if (taken > 0) summary.push(`Total for ${short(day)}: ${peso(taken)}`);
    if (paid > 0) summary.push(`Paid on ${short(day)}: ${peso(paid)}`);
  }
  if (scope !== 'day' || !oneDay) summary.push(p.balance > 0 ? `Remaining balance: ${peso(p.balance)}` : 'Fully paid. Salamat!');
  return [stall, `Statement for ${p.name} — ${short(oneDay ? day : today())}`, '', ...lines, '', ...summary].join('\n');
}
