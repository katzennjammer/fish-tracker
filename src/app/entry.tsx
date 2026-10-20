import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, confirm, LedgerLine, Screen, SheetHeader, T, Tag, done } from '../components/ui';
import { addPayment, deleteEntry, getEntry, personLedger, TABLE_KIND, type EntryDetail, type EntryTable } from '../lib/db';
import { entryKey, settle, type Settlement } from '../lib/settle';
import { useQuery } from '../lib/useQuery';
import { kg, peso } from '../lib/format';
import { short, today } from '../lib/dates';
import { color, space } from '../lib/theme';

const TITLES: Record<EntryTable, string> = {
  sales: 'Sale',
  purchases: 'Stock bought',
  balances: 'Utang',
  payments: 'Payment',
  spoilage: 'Spoiled fish',
  expenses: 'Expense',
};

/** One record: its details, and the things she can do with it. */
export default function EntryScreen() {
  const params = useLocalSearchParams<{ table: EntryTable; id: string }>();
  const table = params.table;
  const id = Number(params.id);
  const data = useQuery(async () => {
    const entry = await getEntry(table, id);
    if (!entry) return null;
    let settlement: Settlement | null = null;
    if ((table === 'sales' || table === 'purchases' || table === 'balances') && entry.person_id) {
      settlement = settle(await personLedger(entry.person_id)).get(entryKey(TABLE_KIND[table], id)) ?? null;
    }
    return { entry, settlement };
  }, [table, id]);

  if (data === null) {
    return (
      <Screen>
        <SheetHeader title="Not found" subtitle="This record was already deleted." />
      </Screen>
    );
  }
  if (!data) return <Screen><View /></Screen>;
  const { entry: e, settlement } = data;
  const isTrade = table === 'sales' || table === 'purchases';
  const isOwed = isTrade || table === 'balances';
  const left = settlement?.left ?? 0;
  const heading = table === 'balances' ? e.title : TITLES[table];

  async function markPaid() {
    if (!e.person_id || left <= 0) return;
    const who = e.person_kind === 'customer' ? `${e.person} paid` : `You paid ${e.person}`;
    const ok = await confirm(
      'Mark as paid?',
      `${who} ${peso(left)} today for ${e.title} (${short(e.date)}).`,
      'Mark as paid',
    );
    if (!ok) return;
    await addPayment({
      date: today(),
      personId: e.person_id,
      amount: left,
      forEntry: e.id,
      forKind: table === 'balances' ? 'balance' : table === 'sales' ? 'sale' : 'purchase',
      note: `For ${e.title} ${short(e.date)}`,
    });
    done('Marked as paid');
  }

  async function remove() {
    const ok = await confirm('Delete this record?', `${heading} — ${describe(e)}. This cannot be undone.`);
    if (!ok) return;
    await deleteEntry(table, id);
    done('Deleted');
  }

  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          {isOwed && left > 0 ? <Button label={`Mark as paid · ${peso(left)}`} icon="check" onPress={markPaid} /> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              label="Edit"
              kind="secondary"
              icon="edit"
              onPress={() => router.push({ pathname: '/edit-entry', params: { table, id: String(id) } })}
              style={{ flex: 1 }}
            />
            <Button label="Delete" kind="danger" icon="trash" onPress={remove} style={{ flex: 1 }} />
          </View>
        </View>
      }
    >
      <SheetHeader title={heading} subtitle={short(e.date, true)} />

      {isOwed && settlement ? (
        <View style={{ marginBottom: space.md }}>
          {settlement.owed <= 0 ? (
            <Tag label="PAID IN FULL" tone="green" />
          ) : left === 0 ? (
            <Tag label={`PAID ✓ ${settlement.settledOn ? short(settlement.settledOn) : ''}`} tone="green" />
          ) : left < settlement.owed ? (
            <Tag label={`${peso(left)} LEFT`} tone="brass" />
          ) : (
            <Tag label="UNPAID" tone="red" />
          )}
        </View>
      ) : null}

      <Card>
        {e.person ? (
          <LedgerLine label={e.person_kind === 'supplier' ? 'Supplier' : 'Customer'} value={e.person} />
        ) : isTrade ? (
          <LedgerLine label="Customer" value="Walk-in" />
        ) : null}
        {table === 'expenses' ? <LedgerLine label="For" value={e.title} /> : null}
        {isTrade || table === 'spoilage' ? <LedgerLine label="Fish" value={e.title} /> : null}
        {e.kg !== null ? <LedgerLine label="Kilos" value={kg(e.kg)} /> : null}
        {e.price !== null ? <LedgerLine label="Price per kg" value={peso(e.price)} /> : null}
        {table !== 'spoilage' ? <LedgerLine bold label={isTrade ? 'Total' : 'Amount'} value={peso(e.total)} /> : null}
        {isTrade && e.paid !== null ? <LedgerLine label="Paid at the time" value={peso(e.paid)} /> : null}
        {isOwed && settlement && settlement.owed > 0 ? (
          <LedgerLine
            bold
            label="Still unpaid"
            value={peso(left)}
            c={left > 0 ? (e.person_kind === 'supplier' ? color.brass : color.red) : color.green}
          />
        ) : null}
      </Card>
      {e.note ? (
        <Card style={{ marginTop: space.md }}>
          <T v="caption">Note</T>
          <T v="body">{e.note}</T>
        </Card>
      ) : null}
      {e.person_id ? (
        <Button
          small
          kind="ghost"
          label={`Open ${e.person}`}
          onPress={() => router.push({ pathname: '/person/[id]', params: { id: String(e.person_id) } })}
          style={{ marginTop: space.lg, alignSelf: 'flex-start' }}
        />
      ) : null}
    </Screen>
  );
}

function describe(e: EntryDetail) {
  if (e.kg !== null && e.price !== null) return `${e.title} ${kg(e.kg)} × ${peso(e.price)} = ${peso(e.total)}`;
  if (e.kg !== null) return `${e.title} ${kg(e.kg)}`;
  return `${e.title} ${peso(e.total)}`;
}
