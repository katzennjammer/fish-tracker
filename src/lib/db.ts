import type { SQLiteDatabase } from 'expo-sqlite';
import { addDays, addMonths, nowStamp, today } from './dates';

// One SQLite file on the phone holds everything. Amounts are integer
// centavos; weights are kilograms as REAL.

let db: SQLiteDatabase;
const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed() {
  listeners.forEach((fn) => fn());
}

const SCHEMA_VERSION = 1;

export async function migrate(database: SQLiteDatabase) {
  db = database;
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version >= SCHEMA_VERSION) return;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

      CREATE TABLE IF NOT EXISTS fish (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sell_price INTEGER NOT NULL DEFAULT 0,
        buy_price INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL CHECK (kind IN ('customer', 'supplier')),
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS days (
        date TEXT PRIMARY KEY NOT NULL,
        opening_cash INTEGER NOT NULL DEFAULT 0,
        counted_cash INTEGER,
        closed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        fish_id INTEGER NOT NULL REFERENCES fish(id),
        kg REAL NOT NULL,
        price INTEGER NOT NULL,
        total INTEGER NOT NULL,
        paid INTEGER NOT NULL,
        customer_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sales_date ON sales(date);
      CREATE INDEX IF NOT EXISTS sales_customer ON sales(customer_id);

      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        fish_id INTEGER NOT NULL REFERENCES fish(id),
        kg REAL NOT NULL,
        price INTEGER NOT NULL,
        total INTEGER NOT NULL,
        paid INTEGER NOT NULL,
        supplier_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS purchases_date ON purchases(date);
      CREATE INDEX IF NOT EXISTS purchases_supplier ON purchases(supplier_id);

      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS payments_person ON payments(person_id);
      CREATE INDEX IF NOT EXISTS payments_date ON payments(date);

      CREATE TABLE IF NOT EXISTS spoilage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        fish_id INTEGER NOT NULL REFERENCES fish(id),
        kg REAL NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS expenses_date ON expenses(date);

      CREATE TABLE IF NOT EXISTS loans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lender TEXT NOT NULL,
        principal INTEGER NOT NULL,
        total_payable INTEGER NOT NULL,
        installments INTEGER NOT NULL,
        frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
        first_due TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS loan_dues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        due_date TEXT NOT NULL,
        amount INTEGER NOT NULL,
        paid_date TEXT,
        notify_ids TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS loan_dues_loan ON loan_dues(loan_id);
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/* ───────────────────────── settings ───────────────────────── */

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
  changed();
}

/* ───────────────────────── fish ───────────────────────── */

export type Fish = {
  id: number;
  name: string;
  sell_price: number;
  buy_price: number;
  archived: number;
};

export type FishWithStock = Fish & { bought: number; sold: number; spoiled: number; stock: number };

export async function listFish(includeArchived = false): Promise<FishWithStock[]> {
  return db.getAllAsync<FishWithStock>(
    `SELECT f.*,
       COALESCE((SELECT SUM(kg) FROM purchases WHERE fish_id = f.id), 0) AS bought,
       COALESCE((SELECT SUM(kg) FROM sales WHERE fish_id = f.id), 0) AS sold,
       COALESCE((SELECT SUM(kg) FROM spoilage WHERE fish_id = f.id), 0) AS spoiled,
       COALESCE((SELECT SUM(kg) FROM purchases WHERE fish_id = f.id), 0)
         - COALESCE((SELECT SUM(kg) FROM sales WHERE fish_id = f.id), 0)
         - COALESCE((SELECT SUM(kg) FROM spoilage WHERE fish_id = f.id), 0) AS stock
     FROM fish f
     WHERE (? OR f.archived = 0)
     ORDER BY f.archived, f.name COLLATE NOCASE`,
    [includeArchived ? 1 : 0],
  );
}

export async function getFish(id: number): Promise<FishWithStock | null> {
  const all = await listFish(true);
  return all.find((f) => f.id === id) ?? null;
}

export async function saveFish(f: { id?: number; name: string; sell_price: number; buy_price: number }) {
  if (f.id) {
    await db.runAsync('UPDATE fish SET name = ?, sell_price = ?, buy_price = ? WHERE id = ?', [
      f.name, f.sell_price, f.buy_price, f.id,
    ]);
  } else {
    await db.runAsync('INSERT INTO fish (name, sell_price, buy_price, created_at) VALUES (?, ?, ?, ?)', [
      f.name, f.sell_price, f.buy_price, nowStamp(),
    ]);
  }
  changed();
}

export async function setFishArchived(id: number, archived: boolean) {
  await db.runAsync('UPDATE fish SET archived = ? WHERE id = ?', [archived ? 1 : 0, id]);
  changed();
}

/** Remember the latest price used so the next sale starts from it. */
async function rememberPrice(fishId: number, column: 'sell_price' | 'buy_price', price: number) {
  await db.runAsync(`UPDATE fish SET ${column} = ? WHERE id = ?`, [price, fishId]);
}

export type FishMovement = {
  kind: 'sale' | 'purchase' | 'spoilage';
  id: number;
  date: string;
  kg: number;
  price: number;
  total: number;
  person: string | null;
};

export async function fishHistory(fishId: number, limit = 60): Promise<FishMovement[]> {
  return db.getAllAsync<FishMovement>(
    `SELECT * FROM (
       SELECT 'sale' AS kind, s.id, s.date, s.kg, s.price, s.total, p.name AS person, s.created_at
         FROM sales s LEFT JOIN people p ON p.id = s.customer_id WHERE s.fish_id = ?
       UNION ALL
       SELECT 'purchase', u.id, u.date, u.kg, u.price, u.total, p.name, u.created_at
         FROM purchases u LEFT JOIN people p ON p.id = u.supplier_id WHERE u.fish_id = ?
       UNION ALL
       SELECT 'spoilage', w.id, w.date, w.kg, 0, 0, NULL, w.created_at FROM spoilage w WHERE w.fish_id = ?
     ) ORDER BY date DESC, created_at DESC LIMIT ?`,
    [fishId, fishId, fishId, limit],
  );
}

/** Weighted average cost per kg from purchases, falling back to the fish's buy price. */
async function avgCosts(): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ id: number; buy_price: number; kg: number | null; total: number | null }>(
    `SELECT f.id, f.buy_price, SUM(p.kg) AS kg, SUM(p.total) AS total
     FROM fish f LEFT JOIN purchases p ON p.fish_id = f.id GROUP BY f.id`,
  );
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.id, r.kg && r.total ? r.total / r.kg : r.buy_price);
  return map;
}

/* ───────────────────────── people ───────────────────────── */

export type PersonKind = 'customer' | 'supplier';

export type Person = {
  id: number;
  name: string;
  phone: string;
  kind: PersonKind;
  note: string;
};

export type PersonSummary = Person & {
  charged: number;
  paid: number;
  balance: number;
  first_credit: string | null;
  first_payment: string | null;
  last_payment: string | null;
  last_activity: string | null;
};

const PERSON_SUMMARY = `
  SELECT p.*,
    COALESCE((SELECT SUM(total - paid) FROM sales WHERE customer_id = p.id), 0)
      + COALESCE((SELECT SUM(total - paid) FROM purchases WHERE supplier_id = p.id), 0) AS charged,
    COALESCE((SELECT SUM(amount) FROM payments WHERE person_id = p.id), 0) AS paid,
    (SELECT MIN(d) FROM (
       SELECT MIN(date) AS d FROM sales WHERE customer_id = p.id AND total > paid
       UNION ALL SELECT MIN(date) FROM purchases WHERE supplier_id = p.id AND total > paid)) AS first_credit,
    (SELECT MIN(date) FROM payments WHERE person_id = p.id) AS first_payment,
    (SELECT MAX(date) FROM payments WHERE person_id = p.id) AS last_payment,
    (SELECT MAX(d) FROM (
       SELECT MAX(date) AS d FROM sales WHERE customer_id = p.id
       UNION ALL SELECT MAX(date) FROM purchases WHERE supplier_id = p.id
       UNION ALL SELECT MAX(date) FROM payments WHERE person_id = p.id)) AS last_activity
  FROM people p`;

function withBalance(rows: Omit<PersonSummary, 'balance'>[]): PersonSummary[] {
  return rows.map((r) => ({ ...r, balance: r.charged - r.paid }));
}

export async function listPeople(kind: PersonKind): Promise<PersonSummary[]> {
  const rows = await db.getAllAsync<Omit<PersonSummary, 'balance'>>(
    `${PERSON_SUMMARY} WHERE p.kind = ? ORDER BY p.name COLLATE NOCASE`,
    [kind],
  );
  return withBalance(rows);
}

export async function getPerson(id: number): Promise<PersonSummary | null> {
  const rows = await db.getAllAsync<Omit<PersonSummary, 'balance'>>(`${PERSON_SUMMARY} WHERE p.id = ?`, [id]);
  return withBalance(rows)[0] ?? null;
}

export async function savePerson(p: { id?: number; name: string; phone: string; kind: PersonKind; note: string }) {
  if (p.id) {
    await db.runAsync('UPDATE people SET name = ?, phone = ?, note = ? WHERE id = ?', [p.name, p.phone, p.note, p.id]);
    changed();
    return p.id;
  }
  const res = await db.runAsync('INSERT INTO people (name, phone, kind, note, created_at) VALUES (?, ?, ?, ?, ?)', [
    p.name, p.phone, p.kind, p.note, nowStamp(),
  ]);
  changed();
  return res.lastInsertRowId;
}

export async function deletePerson(id: number) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sales WHERE customer_id = ?', [id]);
    await db.runAsync('DELETE FROM purchases WHERE supplier_id = ?', [id]);
    await db.runAsync('DELETE FROM payments WHERE person_id = ?', [id]);
    await db.runAsync('DELETE FROM people WHERE id = ?', [id]);
  });
  changed();
}

export type LedgerEntry = {
  kind: 'sale' | 'purchase' | 'payment';
  id: number;
  date: string;
  fish: string | null;
  kg: number | null;
  price: number | null;
  total: number;
  paid: number;
  note: string;
  created_at: string;
};

/** Oldest first so a running balance can be drawn. */
export async function personLedger(id: number): Promise<LedgerEntry[]> {
  return db.getAllAsync<LedgerEntry>(
    `SELECT * FROM (
       SELECT 'sale' AS kind, s.id, s.date, f.name AS fish, s.kg, s.price, s.total, s.paid, s.note, s.created_at
         FROM sales s JOIN fish f ON f.id = s.fish_id WHERE s.customer_id = ?
       UNION ALL
       SELECT 'purchase', u.id, u.date, f.name, u.kg, u.price, u.total, u.paid, u.note, u.created_at
         FROM purchases u JOIN fish f ON f.id = u.fish_id WHERE u.supplier_id = ?
       UNION ALL
       SELECT 'payment', y.id, y.date, NULL, NULL, NULL, y.amount, y.amount, y.note, y.created_at
         FROM payments y WHERE y.person_id = ?
     ) ORDER BY date, created_at`,
    [id, id, id],
  );
}

/* ───────────────────────── entries ───────────────────────── */

export async function addSale(s: {
  date: string; fishId: number; kg: number; price: number; paid: number; customerId: number | null; note?: string;
}) {
  const total = Math.round(s.kg * s.price);
  await db.runAsync(
    'INSERT INTO sales (date, fish_id, kg, price, total, paid, customer_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [s.date, s.fishId, s.kg, s.price, total, Math.min(s.paid, total), s.customerId, s.note ?? '', nowStamp()],
  );
  await rememberPrice(s.fishId, 'sell_price', s.price);
  changed();
}

export async function addPurchase(p: {
  date: string; fishId: number; kg: number; price: number; paid: number; supplierId: number | null; note?: string;
}) {
  const total = Math.round(p.kg * p.price);
  await db.runAsync(
    'INSERT INTO purchases (date, fish_id, kg, price, total, paid, supplier_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [p.date, p.fishId, p.kg, p.price, total, Math.min(p.paid, total), p.supplierId, p.note ?? '', nowStamp()],
  );
  await rememberPrice(p.fishId, 'buy_price', p.price);
  changed();
}

export async function addPayment(p: { date: string; personId: number; amount: number; note?: string }) {
  await db.runAsync('INSERT INTO payments (date, person_id, amount, note, created_at) VALUES (?, ?, ?, ?, ?)', [
    p.date, p.personId, p.amount, p.note ?? '', nowStamp(),
  ]);
  changed();
}

export async function addSpoilage(s: { date: string; fishId: number; kg: number; note?: string }) {
  await db.runAsync('INSERT INTO spoilage (date, fish_id, kg, note, created_at) VALUES (?, ?, ?, ?, ?)', [
    s.date, s.fishId, s.kg, s.note ?? '', nowStamp(),
  ]);
  changed();
}

export type EntryTable = 'sales' | 'purchases' | 'payments' | 'spoilage' | 'expenses';

export async function deleteEntry(table: EntryTable, id: number) {
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
  changed();
}

/* ───────────────────────── expenses ───────────────────────── */

export const EXPENSE_CATEGORIES = [
  'Ice', 'Transport', 'Plastic bags', 'Stall rent', 'Helper', 'Load', 'Food', 'Utilities', 'Other',
] as const;

export type Expense = { id: number; date: string; category: string; amount: number; note: string };

export async function addExpense(e: { date: string; category: string; amount: number; note: string }) {
  await db.runAsync('INSERT INTO expenses (date, category, amount, note, created_at) VALUES (?, ?, ?, ?, ?)', [
    e.date, e.category, e.amount, e.note, nowStamp(),
  ]);
  changed();
}

export async function listExpenses(start: string, end: string): Promise<Expense[]> {
  return db.getAllAsync<Expense>(
    'SELECT id, date, category, amount, note FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC',
    [start, end],
  );
}

/* ───────────────────────── the day ───────────────────────── */

export type Day = { date: string; opening_cash: number; counted_cash: number | null; closed_at: string | null };

export async function getDay(date: string): Promise<Day | null> {
  return db.getFirstAsync<Day>('SELECT * FROM days WHERE date = ?', [date]);
}

export async function setOpeningCash(date: string, cents: number) {
  await db.runAsync(
    `INSERT INTO days (date, opening_cash) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET opening_cash = excluded.opening_cash`,
    [date, cents],
  );
  changed();
}

export async function closeDay(date: string, counted: number | null) {
  await db.runAsync(
    `INSERT INTO days (date, opening_cash, counted_cash, closed_at) VALUES (?, 0, ?, ?)
     ON CONFLICT(date) DO UPDATE SET counted_cash = excluded.counted_cash, closed_at = excluded.closed_at`,
    [date, counted, counted === null ? null : nowStamp()],
  );
  changed();
}

/** Counted cash from the last closed day before `date`, to suggest as today's capital. */
export async function lastCountedCash(date: string): Promise<{ date: string; cash: number } | null> {
  const row = await db.getFirstAsync<{ date: string; counted_cash: number }>(
    'SELECT date, counted_cash FROM days WHERE date < ? AND counted_cash IS NOT NULL ORDER BY date DESC LIMIT 1',
    [date],
  );
  return row ? { date: row.date, cash: row.counted_cash } : null;
}

export type DaySummary = {
  opening: number;
  opened: boolean;
  salesTotal: number;
  cashSales: number;
  creditSales: number;
  kgSold: number;
  collections: number;
  stockPaid: number;
  supplierPayments: number;
  expenses: number;
  expected: number;
  counted: number | null;
  closed: boolean;
};

export async function daySummary(date: string): Promise<DaySummary> {
  const r = await db.getFirstAsync<{
    opening: number | null;
    counted: number | null;
    closed_at: string | null;
    sales_total: number;
    cash_sales: number;
    kg_sold: number;
    collections: number;
    stock_paid: number;
    supplier_payments: number;
    expenses: number;
  }>(
    `SELECT
       (SELECT opening_cash FROM days WHERE date = $d) AS opening,
       (SELECT counted_cash FROM days WHERE date = $d) AS counted,
       (SELECT closed_at FROM days WHERE date = $d) AS closed_at,
       COALESCE((SELECT SUM(total) FROM sales WHERE date = $d), 0) AS sales_total,
       COALESCE((SELECT SUM(paid) FROM sales WHERE date = $d), 0) AS cash_sales,
       COALESCE((SELECT SUM(kg) FROM sales WHERE date = $d), 0) AS kg_sold,
       COALESCE((SELECT SUM(y.amount) FROM payments y JOIN people p ON p.id = y.person_id
                 WHERE y.date = $d AND p.kind = 'customer'), 0) AS collections,
       COALESCE((SELECT SUM(paid) FROM purchases WHERE date = $d), 0) AS stock_paid,
       COALESCE((SELECT SUM(y.amount) FROM payments y JOIN people p ON p.id = y.person_id
                 WHERE y.date = $d AND p.kind = 'supplier'), 0) AS supplier_payments,
       COALESCE((SELECT SUM(amount) FROM expenses WHERE date = $d), 0) AS expenses`,
    { $d: date },
  );
  const opening = r?.opening ?? 0;
  const s = r!;
  const expected = opening + s.cash_sales + s.collections - s.stock_paid - s.supplier_payments - s.expenses;
  return {
    opening,
    opened: r?.opening !== null && r?.opening !== undefined,
    salesTotal: s.sales_total,
    cashSales: s.cash_sales,
    creditSales: s.sales_total - s.cash_sales,
    kgSold: s.kg_sold,
    collections: s.collections,
    stockPaid: s.stock_paid,
    supplierPayments: s.supplier_payments,
    expenses: s.expenses,
    expected,
    counted: s.counted,
    closed: !!s.closed_at,
  };
}

export type Activity = {
  table: EntryTable;
  id: number;
  title: string;
  detail: string;
  amount: number;
  /** +1 money in, -1 money out, 0 no cash moved (credit / spoilage) */
  flow: 1 | -1 | 0;
  person: string | null;
  kg: number | null;
  price: number | null;
  paid: number | null;
  created_at: string;
};

export async function dayActivity(date: string): Promise<Activity[]> {
  const rows = await db.getAllAsync<{
    t: EntryTable; id: number; title: string; kind: string | null; person: string | null;
    kg: number | null; price: number | null; total: number; paid: number | null; note: string; created_at: string;
  }>(
    `SELECT * FROM (
       SELECT 'sales' AS t, s.id, f.name AS title, NULL AS kind, p.name AS person, s.kg, s.price, s.total, s.paid, s.note, s.created_at
         FROM sales s JOIN fish f ON f.id = s.fish_id LEFT JOIN people p ON p.id = s.customer_id WHERE s.date = $d
       UNION ALL
       SELECT 'purchases', u.id, f.name, NULL, p.name, u.kg, u.price, u.total, u.paid, u.note, u.created_at
         FROM purchases u JOIN fish f ON f.id = u.fish_id LEFT JOIN people p ON p.id = u.supplier_id WHERE u.date = $d
       UNION ALL
       SELECT 'payments', y.id, p.name, p.kind, p.name, NULL, NULL, y.amount, y.amount, y.note, y.created_at
         FROM payments y JOIN people p ON p.id = y.person_id WHERE y.date = $d
       UNION ALL
       SELECT 'spoilage', w.id, f.name, NULL, NULL, w.kg, NULL, 0, NULL, w.note, w.created_at
         FROM spoilage w JOIN fish f ON f.id = w.fish_id WHERE w.date = $d
       UNION ALL
       SELECT 'expenses', e.id, e.category, NULL, NULL, NULL, NULL, e.amount, e.amount, e.note, e.created_at
         FROM expenses e WHERE e.date = $d
     ) ORDER BY created_at DESC`,
    { $d: date },
  );
  return rows.map((r): Activity => {
    const base = {
      table: r.t, id: r.id, person: r.person, kg: r.kg, price: r.price, paid: r.paid,
      amount: r.total, created_at: r.created_at,
    };
    switch (r.t) {
      case 'sales':
        return { ...base, title: `Sold ${r.title}`, detail: r.person ?? 'Walk-in', flow: r.paid ? 1 : 0 };
      case 'purchases':
        return { ...base, title: `Bought ${r.title}`, detail: r.person ?? 'Stock', flow: r.paid ? -1 : 0 };
      case 'payments':
        return r.kind === 'customer'
          ? { ...base, title: `${r.title} paid`, detail: r.note || 'Utang payment', flow: 1 }
          : { ...base, title: `Paid ${r.title}`, detail: r.note || 'Supplier payment', flow: -1 };
      case 'spoilage':
        return { ...base, title: `Spoiled ${r.title}`, detail: r.note || 'Not sellable', flow: 0 };
      default:
        return { ...base, title: r.title, detail: r.note || 'Expense', flow: -1 };
    }
  });
}

export type FishDay = {
  id: number; name: string; bought: number; sold: number; spoiled: number; sales: number; stock: number;
  /** Whether any stock of this fish was ever recorded up to this day. */
  tracked: number;
};

export async function fishAudit(date: string): Promise<FishDay[]> {
  return db.getAllAsync<FishDay>(
    `SELECT f.id, f.name,
       COALESCE((SELECT SUM(kg) FROM purchases WHERE fish_id = f.id AND date = $d), 0) AS bought,
       COALESCE((SELECT SUM(kg) FROM sales WHERE fish_id = f.id AND date = $d), 0) AS sold,
       COALESCE((SELECT SUM(kg) FROM spoilage WHERE fish_id = f.id AND date = $d), 0) AS spoiled,
       COALESCE((SELECT SUM(total) FROM sales WHERE fish_id = f.id AND date = $d), 0) AS sales,
       COALESCE((SELECT SUM(kg) FROM purchases WHERE fish_id = f.id AND date <= $d), 0)
         - COALESCE((SELECT SUM(kg) FROM sales WHERE fish_id = f.id AND date <= $d), 0)
         - COALESCE((SELECT SUM(kg) FROM spoilage WHERE fish_id = f.id AND date <= $d), 0) AS stock,
       EXISTS (SELECT 1 FROM purchases WHERE fish_id = f.id AND date <= $d) AS tracked
     FROM fish f
     WHERE f.archived = 0 OR EXISTS (SELECT 1 FROM sales WHERE fish_id = f.id AND date = $d)
     ORDER BY sales DESC, f.name COLLATE NOCASE`,
    { $d: date },
  );
}

/* ───────────────────────── reports ───────────────────────── */

export type Report = {
  revenue: number;
  cashIn: number;
  cost: number;
  spoilageCost: number;
  expenses: number;
  gross: number;
  net: number;
  kgSold: number;
  topFish: { id: number; name: string; kg: number; total: number }[];
  daily: { date: string; total: number }[];
  expenseByCategory: { category: string; amount: number }[];
  receivable: number;
  payable: number;
  loansLeft: number;
};

export async function report(start: string, end: string): Promise<Report> {
  const costs = await avgCosts();
  const perFish = await db.getAllAsync<{ id: number; name: string; kg: number; total: number; paid: number }>(
    `SELECT f.id, f.name, SUM(s.kg) AS kg, SUM(s.total) AS total, SUM(s.paid) AS paid
     FROM sales s JOIN fish f ON f.id = s.fish_id WHERE s.date BETWEEN ? AND ?
     GROUP BY f.id ORDER BY total DESC`,
    [start, end],
  );
  const spoiled = await db.getAllAsync<{ fish_id: number; kg: number }>(
    'SELECT fish_id, SUM(kg) AS kg FROM spoilage WHERE date BETWEEN ? AND ? GROUP BY fish_id',
    [start, end],
  );
  const daily = await db.getAllAsync<{ date: string; total: number }>(
    'SELECT date, SUM(total) AS total FROM sales WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date',
    [start, end],
  );
  const expenseByCategory = await db.getAllAsync<{ category: string; amount: number }>(
    'SELECT category, SUM(amount) AS amount FROM expenses WHERE date BETWEEN ? AND ? GROUP BY category ORDER BY amount DESC',
    [start, end],
  );
  const balances = await db.getFirstAsync<{ receivable: number; payable: number; loans_left: number; collected: number }>(
    `SELECT
       COALESCE((SELECT SUM(total - paid) FROM sales), 0)
         - COALESCE((SELECT SUM(y.amount) FROM payments y JOIN people p ON p.id = y.person_id WHERE p.kind = 'customer'), 0) AS receivable,
       COALESCE((SELECT SUM(total - paid) FROM purchases), 0)
         - COALESCE((SELECT SUM(y.amount) FROM payments y JOIN people p ON p.id = y.person_id WHERE p.kind = 'supplier'), 0) AS payable,
       COALESCE((SELECT SUM(amount) FROM loan_dues WHERE paid_date IS NULL), 0) AS loans_left,
       COALESCE((SELECT SUM(y.amount) FROM payments y JOIN people p ON p.id = y.person_id
                 WHERE p.kind = 'customer' AND y.date BETWEEN ? AND ?), 0) AS collected`,
    [start, end],
  );
  const revenue = perFish.reduce((a, f) => a + f.total, 0);
  const cost = Math.round(perFish.reduce((a, f) => a + f.kg * (costs.get(f.id) ?? 0), 0));
  const spoilageCost = Math.round(spoiled.reduce((a, s) => a + s.kg * (costs.get(s.fish_id) ?? 0), 0));
  const expenses = expenseByCategory.reduce((a, e) => a + e.amount, 0);
  const gross = revenue - cost;
  return {
    revenue,
    cashIn: perFish.reduce((a, f) => a + f.paid, 0) + (balances?.collected ?? 0),
    cost,
    spoilageCost,
    expenses,
    gross,
    net: gross - spoilageCost - expenses,
    kgSold: perFish.reduce((a, f) => a + f.kg, 0),
    topFish: perFish.map(({ id, name, kg, total }) => ({ id, name, kg, total })),
    daily,
    expenseByCategory,
    receivable: balances?.receivable ?? 0,
    payable: balances?.payable ?? 0,
    loansLeft: balances?.loans_left ?? 0,
  };
}

/* ───────────────────────── online loans ───────────────────────── */

export type Frequency = 'weekly' | 'biweekly' | 'monthly';

export type Loan = {
  id: number;
  lender: string;
  principal: number;
  total_payable: number;
  installments: number;
  frequency: Frequency;
  first_due: string;
  note: string;
};

export type LoanSummary = Loan & {
  paid_amount: number;
  paid_count: number;
  next_due: string | null;
  next_amount: number | null;
};

export type LoanDue = {
  id: number;
  loan_id: number;
  seq: number;
  due_date: string;
  amount: number;
  paid_date: string | null;
  notify_ids: string;
};

export async function listLoans(): Promise<LoanSummary[]> {
  return db.getAllAsync<LoanSummary>(
    `SELECT l.*,
       COALESCE((SELECT SUM(amount) FROM loan_dues WHERE loan_id = l.id AND paid_date IS NOT NULL), 0) AS paid_amount,
       (SELECT COUNT(*) FROM loan_dues WHERE loan_id = l.id AND paid_date IS NOT NULL) AS paid_count,
       (SELECT MIN(due_date) FROM loan_dues WHERE loan_id = l.id AND paid_date IS NULL) AS next_due,
       (SELECT amount FROM loan_dues WHERE loan_id = l.id AND paid_date IS NULL ORDER BY seq LIMIT 1) AS next_amount
     FROM loans l
     ORDER BY next_due IS NULL, next_due, l.created_at DESC`,
  );
}

export async function getLoan(id: number): Promise<{ loan: LoanSummary; dues: LoanDue[] } | null> {
  const loans = await listLoans();
  const loan = loans.find((l) => l.id === id);
  if (!loan) return null;
  const dues = await db.getAllAsync<LoanDue>('SELECT * FROM loan_dues WHERE loan_id = ? ORDER BY seq', [id]);
  return { loan, dues };
}

export function dueDates(first: string, count: number, freq: Frequency): string[] {
  return Array.from({ length: count }, (_, i) =>
    freq === 'monthly' ? addMonths(first, i) : addDays(first, i * (freq === 'weekly' ? 7 : 14)),
  );
}

/** Split a total into `n` installments; the last one absorbs the rounding. */
export function splitInstallments(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? total - base * (n - 1) : base));
}

export async function addLoan(l: Omit<Loan, 'id'>): Promise<number> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      'INSERT INTO loans (lender, principal, total_payable, installments, frequency, first_due, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [l.lender, l.principal, l.total_payable, l.installments, l.frequency, l.first_due, l.note, nowStamp()],
    );
    id = res.lastInsertRowId;
    const dates = dueDates(l.first_due, l.installments, l.frequency);
    const amounts = splitInstallments(l.total_payable, l.installments);
    for (let i = 0; i < dates.length; i++) {
      await db.runAsync('INSERT INTO loan_dues (loan_id, seq, due_date, amount) VALUES (?, ?, ?, ?)', [
        id, i + 1, dates[i], amounts[i],
      ]);
    }
  });
  changed();
  return id;
}

export async function setDuePaid(dueId: number, paidDate: string | null) {
  await db.runAsync('UPDATE loan_dues SET paid_date = ? WHERE id = ?', [paidDate, dueId]);
  changed();
}

export async function setDueAmount(dueId: number, amount: number) {
  await db.runAsync('UPDATE loan_dues SET amount = ? WHERE id = ?', [amount, dueId]);
  await db.runAsync(
    'UPDATE loans SET total_payable = (SELECT SUM(amount) FROM loan_dues WHERE loan_id = loans.id) WHERE id = (SELECT loan_id FROM loan_dues WHERE id = ?)',
    [dueId],
  );
  changed();
}

export async function setDueNotifyIds(dueId: number, ids: string[]) {
  await db.runAsync('UPDATE loan_dues SET notify_ids = ? WHERE id = ?', [ids.join(','), dueId]);
}

export async function unpaidDues(): Promise<(LoanDue & { lender: string })[]> {
  return db.getAllAsync<LoanDue & { lender: string }>(
    `SELECT d.*, l.lender FROM loan_dues d JOIN loans l ON l.id = d.loan_id
     WHERE d.paid_date IS NULL ORDER BY d.due_date`,
  );
}

export async function deleteLoan(id: number) {
  await db.runAsync('DELETE FROM loans WHERE id = ?', [id]);
  changed();
}

/** Loans with an installment due within `days` (or overdue). */
export async function upcomingDues(days = 3): Promise<(LoanDue & { lender: string })[]> {
  return db.getAllAsync<LoanDue & { lender: string }>(
    `SELECT d.*, l.lender FROM loan_dues d JOIN loans l ON l.id = d.loan_id
     WHERE d.paid_date IS NULL AND d.due_date <= ? ORDER BY d.due_date`,
    [addDays(today(), days)],
  );
}

/* ───────────────────────── backup ───────────────────────── */

const TABLES = [
  'settings', 'fish', 'people', 'days', 'sales', 'purchases', 'payments', 'spoilage', 'expenses', 'loans', 'loan_dues',
] as const;

export type Backup = { app: 'fish-ledger'; version: number; exported_at: string; tables: Record<string, unknown[]> };

export async function exportAll(): Promise<Backup> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await db.getAllAsync(`SELECT * FROM ${t}`);
  // The PIN lives in secure storage, not in the backup.
  return { app: 'fish-ledger', version: SCHEMA_VERSION, exported_at: nowStamp(), tables };
}

export async function importAll(backup: Backup) {
  if (backup?.app !== 'fish-ledger' || typeof backup.tables !== 'object') {
    throw new Error('This file is not a Fish Ledger backup.');
  }
  await db.withTransactionAsync(async () => {
    for (const t of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of TABLES) {
      const rows = (backup.tables[t] ?? []) as Record<string, string | number | null>[];
      for (const row of rows) {
        const cols = Object.keys(row);
        if (cols.length === 0 || cols.some((c) => !/^[a-z_]+$/.test(c))) continue;
        await db.runAsync(
          `INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => row[c]),
        );
      }
    }
  });
  changed();
}

export async function counts(): Promise<{ sales: number; people: number; fish: number }> {
  const r = await db.getFirstAsync<{ sales: number; people: number; fish: number }>(
    'SELECT (SELECT COUNT(*) FROM sales) AS sales, (SELECT COUNT(*) FROM people) AS people, (SELECT COUNT(*) FROM fish) AS fish',
  );
  return r ?? { sales: 0, people: 0, fish: 0 };
}

/** A starter list so the first sale is one tap away. Prices are blank on purpose. */
export async function seedFishIfEmpty() {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM fish');
  if (row && row.n > 0) return;
  const names = ['Bangus', 'Tilapia', 'Galunggong', 'Tamban', 'Tulingan', 'Matambaka', 'Pusit', 'Hipon'];
  for (const name of names) {
    await db.runAsync('INSERT INTO fish (name, created_at) VALUES (?, ?)', [name, nowStamp()]);
  }
}
