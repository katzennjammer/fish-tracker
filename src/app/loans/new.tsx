import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, DateStepper, Field, LedgerLine, Screen, Segmented, SheetHeader, T, done } from '../../components/ui';
import { addLoan, dueDates, splitInstallments, type Frequency } from '../../lib/db';
import { syncReminders } from '../../lib/notify';
import { parseAmount, peso, toCents } from '../../lib/format';
import { addMonths, short, today } from '../../lib/dates';
import { color, space } from '../../lib/theme';

const LENDERS = ['GCash GLoan', 'GGives', 'SLoan', 'Tala', 'Home Credit', 'BillEase', 'JuanHand', 'Other'];

export default function NewLoanScreen() {
  const [lender, setLender] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [principalText, setPrincipalText] = useState('');
  const [totalText, setTotalText] = useState('');
  const [countText, setCountText] = useState('');
  const [freq, setFreq] = useState<Frequency>('monthly');
  const [first, setFirst] = useState(addMonths(today(), 1));
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const name = lender === 'Other' ? custom.trim() : lender;
  const principal = toCents(parseAmount(principalText) ?? 0);
  const total = toCents(parseAmount(totalText) ?? 0);
  const count = Math.floor(parseAmount(countText) ?? 0);
  const ok = !!name && principal > 0 && total > 0 && count >= 1 && count <= 120;
  const amounts = ok ? splitInstallments(total, count) : [];
  const dates = ok ? dueDates(first, count, freq) : [];

  async function save() {
    setTried(true);
    if (!ok || !name) return;
    setBusy(true);
    try {
      await addLoan({
        lender: name, principal, total_payable: total, installments: count, frequency: freq, first_due: first, note: note.trim(),
      });
      syncReminders().catch(() => {});
      done();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button label="Save loan" onPress={save} disabled={busy} />}>
      <SheetHeader title="New loan" subtitle="A loan from an app. You will be reminded before each due date." />

      <T v="label" style={{ marginBottom: 10 }}>From which app</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {LENDERS.map((l) => <Chip key={l} label={l} on={lender === l} onPress={() => setLender(l)} />)}
      </View>
      {tried && !name ? <T v="caption" c={color.red} style={{ marginTop: 6 }}>Choose the app</T> : null}
      {lender === 'Other' ? (
        <Field label="App or lender name" value={custom} onChangeText={setCustom} style={{ marginTop: space.lg }} autoCapitalize="words" />
      ) : null}

      <View style={{ flexDirection: 'row', gap: 16, marginTop: space.xl }}>
        <Field
          label="Amount received"
          value={principalText}
          onChangeText={setPrincipalText}
          keyboardType="decimal-pad"
          prefix="₱"
          placeholder="0"
          style={{ flex: 1 }}
          error={tried && !principal ? 'Required' : undefined}
        />
        <Field
          label="Total to pay back"
          value={totalText}
          onChangeText={setTotalText}
          keyboardType="decimal-pad"
          prefix="₱"
          placeholder="0"
          style={{ flex: 1 }}
          error={tried && !total ? 'Required' : undefined}
        />
      </View>

      <Field
        label="Number of payments"
        value={countText}
        onChangeText={setCountText}
        keyboardType="number-pad"
        placeholder="e.g. 6"
        error={tried && !(count >= 1 && count <= 120) ? 'Enter 1 to 120' : undefined}
      />

      <T v="label" style={{ marginBottom: 10 }}>How often</T>
      <Segmented<Frequency>
        value={freq}
        onChange={setFreq}
        options={[{ value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Every 2 wks' }, { value: 'monthly', label: 'Monthly' }]}
      />

      <T v="label" style={{ marginTop: space.xl, marginBottom: 10 }}>First due date</T>
      <DateStepper value={first} onChange={setFirst} max="9999-12-31" />

      {ok ? (
        <Card style={{ marginTop: space.xl }}>
          <LedgerLine label="Each payment" value={peso(amounts[0])} bold />
          <LedgerLine label="Interest & fees" value={peso(Math.max(total - principal, 0))} c={total > principal ? color.red : undefined} />
          <LedgerLine label="Last due" value={short(dates[dates.length - 1])} />
        </Card>
      ) : null}

      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. used for freezer" style={{ marginTop: space.xl }} />
    </Screen>
  );
}
