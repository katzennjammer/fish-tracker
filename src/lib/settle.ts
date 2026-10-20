import type { LedgerEntry, LedgerKind } from './db';

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

/** Sales, purchases and balances share ids across tables, so key by kind too. */
export function entryKey(kind: LedgerKind, id: number) {
  return `${kind}-${id}`;
}

export function settle(ledger: LedgerEntry[]): Map<string, Settlement> {
  const open: Settlement[] = [];
  const byKey = new Map<string, Settlement>();

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
      byKey.set(entryKey(e.kind, e.id), s);
      if (owed > 0) open.push(s);
      continue;
    }
    let amount = e.total;
    if (e.for_entry !== null) {
      // Older payments did not record the kind; a person only has sales or purchases.
      const target =
        e.for_kind !== null
          ? byKey.get(entryKey(e.for_kind, e.for_entry))
          : byKey.get(entryKey('sale', e.for_entry)) ?? byKey.get(entryKey('purchase', e.for_entry));
      if (target) amount = pay(target, amount, e.date);
    }
    for (const s of open) {
      if (amount <= 0) break;
      amount = pay(s, amount, e.date);
    }
  }
  return byKey;
}
