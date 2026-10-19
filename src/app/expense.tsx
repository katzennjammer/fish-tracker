import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Chip, DateStepper, Field, Screen, SheetHeader, T, done } from '../components/ui';
import { addExpense, EXPENSE_CATEGORIES } from '../lib/db';
import { parseAmount, toCents } from '../lib/format';
import { today } from '../lib/dates';
import { color, space } from '../lib/theme';

export default function ExpenseScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(params.date ?? today());
  const [category, setCategory] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const amount = toCents(parseAmount(amountText) ?? 0);
  const finalCategory = category === 'Other' && custom.trim() ? custom.trim() : category;

  async function save() {
    setTried(true);
    if (!finalCategory || !amount) return;
    setBusy(true);
    try {
      await addExpense({ date, category: finalCategory, amount, note: note.trim() });
      done('Expense saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button label="Save expense" onPress={save} disabled={busy} />}>
      <SheetHeader title="Expense" subtitle="Money spent to run the stall." />
      <DateStepper value={date} onChange={setDate} />

      <Field
        label="Amount"
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder="0"
        prefix="₱"
        big
        style={{ marginTop: space.xl }}
        error={tried && !amount ? 'Enter how much' : undefined}
      />

      <T v="label" style={{ marginBottom: 10 }}>What for</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {EXPENSE_CATEGORIES.map((c) => (
          <Chip key={c} label={c} on={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>
      {tried && !category ? <T v="caption" c={color.red} style={{ marginTop: 6 }}>Pick what it was for</T> : null}
      {category === 'Other' ? (
        <Field label="Name it" value={custom} onChangeText={setCustom} placeholder="e.g. Knife sharpening" style={{ marginTop: space.lg }} />
      ) : null}

      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Anything to remember" style={{ marginTop: space.xl }} />
    </Screen>
  );
}
