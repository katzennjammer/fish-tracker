import type { LedgerEntry } from './db';

// Works out which utang entries are already paid off. A payment marked
// against an entry pays that entry first; everything else pays the oldest
// open utang first. Nothing is stored — it is recomputed from the ledger, so
// deleting or adding a payment always gives the right answer.

export type Settlement = {
  /** What was owed on this entry after any upfront payment. */
  owed: number;
  /** What is still unpaid on it now. */
  left: number;
  /** Date of the payment that cleared it, when fully paid later. */
  settledOn: string | null;
};

export function settle(ledger: LedgerEntry[]): Map<number, Settlement> {
  const open: { id: number; s: Settlement }[] = [];
  const byId = new Map<number, Settlement>();

  function pay(s: Settlement, amount: number, date: string): number {
    const used = Math.min(s.left, amount);
    s.left -= used;
    if (s.left === 0 && used > 0) s.settledOn = date;
    return amount - used;
  }

  // The ledger is already oldest first.
  for (const e of ledger) {
    if (e.kind !== 'payment') {
      const owed = e.total - e.paid;
      const s: Settlement = { owed, left: owed, settledOn: null };
      byId.set(e.id, s);
      if (owed > 0) open.push({ id: e.id, s });
      continue;
    }
    let amount = e.total;
    const target = e.for_entry !== null ? byId.get(e.for_entry) : undefined;
    if (target) amount = pay(target, amount, e.date);
    for (const o of open) {
      if (amount <= 0) break;
      amount = pay(o.s, amount, e.date);
    }
  }
  return byId;
}
