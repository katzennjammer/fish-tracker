import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Chip, DateStepper, Field, LedgerLine, Card, Screen, SheetHeader, T, done } from '../components/ui';
import { EXPENSE_CATEGORIES, getEntry, updateEntry, type EntryDetail, type EntryTable } from '../lib/db';
import { useQuery } from '../lib/useQuery';
import { centsToInput, kg as fmtKg, parseAmount, peso, toCents } from '../lib/format';
import { space } from '../lib/theme';

/** Fix a record — kilos, price, amount, date or note — without deleting it. */
export default function EditEntryScreen() {
  const params = useLocalSearchParams<{ table: EntryTable; id: string }>();
  const entry = useQuery(() => getEntry(params.table, Number(params.id)), [params.table, params.id]);
  if (entry === null) return <Screen><SheetHeader title="Not found" subtitle="This record was deleted." /></Screen>;
  if (!entry) return <Screen><View /></Screen>;
  // Keyed so the form starts from the saved values.
  return <EditForm key={`${entry.table}-${entry.id}`} e={entry} />;
}

function EditForm({ e }: { e: EntryDetail }) {
  const trade = e.table === 'sales' || e.table === 'purchases';
  const byKg = trade || e.table === 'spoilage';
  const [date, setDate] = useState(e.date);
  const [kgText, setKgText] = useState(e.kg !== null ? String(e.kg) : '');
  const [priceText, setPriceText] = useState(centsToInput(e.price ?? 0));
  const [paidText, setPaidText] = useState(centsToInput(e.paid ?? 0));
  const [amountText, setAmountText] = useState(centsToInput(e.total));
  const [category, setCategory] = useState(e.title);
  const [note, setNote] = useState(e.note);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const kgValue = parseAmount(kgText) ?? 0;
  const price = toCents(parseAmount(priceText) ?? 0);
  const total = Math.round(kgValue * price);
  const paid = Math.min(toCents(parseAmount(paidText) ?? 0), total);
  const amount = toCents(parseAmount(amountText) ?? 0);
  const valid = byKg ? kgValue > 0 && (!trade || price > 0) : amount > 0;

  async function save() {
    setTried(true);
    if (!valid) return;
    setBusy(true);
    try {
      await updateEntry(e.table, e.id, {
        date,
        note: note.trim(),
        kg: byKg ? kgValue : undefined,
        price: trade ? price : undefined,
        paid: trade ? paid : undefined,
        amount: byKg ? undefined : amount,
        category: e.table === 'expenses' ? category : undefined,
      });
      done('Changes saved');
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<EntryTable, string> = {
    sales: `Edit sale · ${e.title}`,
    purchases: `Edit stock · ${e.title}`,
    balances: `Edit ${e.title.toLowerCase()}`,
    payments: 'Edit payment',
    spoilage: `Edit spoiled · ${e.title}`,
    expenses: 'Edit expense',
  };

  return (
    <Screen footer={<Button label="Save changes" icon="check" onPress={save} disabled={busy} />}>
      <SheetHeader title={titles[e.table]} subtitle={e.person ?? undefined} />
      <DateStepper value={date} onChange={setDate} />

      {byKg ? (
        <View style={{ flexDirection: 'row', gap: 16, marginTop: space.xl }}>
          <Field
            label="Kilos"
            value={kgText}
            onChangeText={setKgText}
            keyboardType="decimal-pad"
            suffix="kg"
            big
            style={{ flex: 1 }}
            error={tried && !kgValue ? 'Enter the kilos' : undefined}
          />
          {trade ? (
            <Field
              label="Price per kg"
              value={priceText}
              onChangeText={setPriceText}
              keyboardType="decimal-pad"
              prefix="₱"
              big
              style={{ flex: 1 }}
              error={tried && !price ? 'Enter the price' : undefined}
            />
          ) : null}
        </View>
      ) : (
        <Field
          label="Amount"
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          prefix="₱"
          big
          style={{ marginTop: space.xl }}
          error={tried && !amount ? 'Enter how much' : undefined}
        />
      )}

      {trade ? (
        <>
          <Field
            label="Paid at the time"
            value={paidText}
            onChangeText={setPaidText}
            keyboardType="decimal-pad"
            prefix="₱"
            hint="The rest goes to utang. Use 0 if it was all utang."
          />
          <Card>
            <LedgerLine label="Total" value={`${fmtKg(kgValue)} × ${peso(price)} = ${peso(total)}`} />
            <LedgerLine bold label="Utang from this" value={peso(total - paid)} />
          </Card>
        </>
      ) : null}

      {e.table === 'expenses' ? (
        <>
          <T v="label" style={{ marginBottom: 10 }}>What for</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.xl }}>
            {[...new Set([...EXPENSE_CATEGORIES, e.title])].map((c) => (
              <Chip key={c} label={c} on={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
        </>
      ) : null}

      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" style={{ marginTop: trade ? space.xl : 0 }} />
    </Screen>
  );
}
