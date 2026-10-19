import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, Field, LedgerLine, Screen, SheetHeader, T, done } from '../components/ui';
import { closeDay, daySummary } from '../lib/db';
import { autoBackup } from '../lib/backup';
import { useQuery } from '../lib/useQuery';
import { centsToInput, parseAmount, peso, toCents } from '../lib/format';
import { short, today } from '../lib/dates';
import { color, space } from '../lib/theme';

/** Count the real cash and compare it with what the records say. */
export default function CloseDayScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date ?? today();
  const s = useQuery(() => daySummary(date), [date]);
  // Until she types, show the count saved earlier (if the day was closed).
  const [typed, setTyped] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const text = typed ?? (s?.counted !== null && s?.counted !== undefined ? centsToInput(s.counted) : '');

  const counted = parseAmount(text);
  const diff = s && counted !== null ? toCents(counted) - s.expected : null;

  async function save() {
    if (counted === null) return;
    setBusy(true);
    try {
      await closeDay(date, toCents(counted));
      // Closing the day is a good moment to refresh today's backup.
      autoBackup(true).catch(() => {});
      done();
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    try {
      await closeDay(date, null);
      done();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {s?.closed ? <Button label="Reopen" kind="ghost" onPress={reopen} disabled={busy} style={{ flex: 1 }} /> : null}
          <Button label="Close the day" onPress={save} disabled={busy || counted === null} style={{ flex: 1.5 }} />
        </View>
      }
    >
      <SheetHeader title="Close the day" subtitle={`Count the cash in your box for ${short(date, true)}.`} />
      {s ? (
        <Card>
          <LedgerLine label="Capital" value={peso(s.opening)} />
          <LedgerLine label="+ Cash sales" value={peso(s.cashSales)} />
          <LedgerLine label="+ Utang collected" value={peso(s.collections)} />
          <LedgerLine label="− Fish bought" value={peso(s.stockPaid)} />
          <LedgerLine label="− Paid suppliers" value={peso(s.supplierPayments)} />
          <LedgerLine label="− Expenses" value={peso(s.expenses)} />
          <View style={{ height: 1, backgroundColor: color.line, marginVertical: 8 }} />
          <LedgerLine bold label="Should have" value={peso(s.expected)} c={color.ink} />
          <T v="caption" style={{ marginTop: 10 }}>
            Sales on utang today: {peso(s.creditSales)} — not in the box, it is in your utang list.
          </T>
        </Card>
      ) : null}

      <Field
        label="Cash you counted"
        value={text}
        onChangeText={setTyped}
        keyboardType="decimal-pad"
        placeholder="0"
        prefix="₱"
        big
        style={{ marginTop: space.xl }}
      />
      {diff !== null ? (
        <Card style={{ backgroundColor: diff === 0 ? color.greenTint : diff > 0 ? color.brassTint : color.redTint, borderWidth: 0 }}>
          <T v="heading" c={diff === 0 ? color.green : diff > 0 ? color.brass : color.red}>
            {diff === 0 ? 'Exactly right' : diff > 0 ? `${peso(diff)} extra` : `${peso(-diff)} missing`}
          </T>
          <T v="caption" style={{ marginTop: 2 }}>
            {diff === 0
              ? 'Your cash matches your records.'
              : diff > 0
                ? 'Maybe a sale or payment was not recorded.'
                : 'Check for an expense or purchase you forgot to add.'}
          </T>
        </Card>
      ) : null}
    </Screen>
  );
}
