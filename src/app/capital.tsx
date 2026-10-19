import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, DateStepper, Field, Screen, SheetHeader, T, done } from '../components/ui';
import { getDay, lastCountedCash, setOpeningCash } from '../lib/db';
import { centsToInput, parseAmount, peso, toCents } from '../lib/format';
import { short, today } from '../lib/dates';
import { space } from '../lib/theme';

/** The money she starts the day with — her puhunan for today. */
export default function CapitalScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(params.date ?? today());
  const [text, setText] = useState('');
  const [suggest, setSuggest] = useState<{ date: string; cash: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const day = await getDay(date);
      const last = await lastCountedCash(date);
      if (!live) return;
      setText(day ? centsToInput(day.opening_cash) : '');
      setSuggest(last);
    })();
    return () => { live = false; };
  }, [date]);

  const value = parseAmount(text);

  async function save() {
    if (value === null) return;
    setBusy(true);
    try {
      await setOpeningCash(date, toCents(value));
      done();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button label="Save capital" onPress={save} disabled={busy || value === null} />}>
      <SheetHeader title="Today’s capital" subtitle="The cash you start with before selling — your puhunan." />
      <DateStepper value={date} onChange={setDate} />
      <Field
        label="Starting cash"
        value={text}
        onChangeText={setText}
        keyboardType="decimal-pad"
        placeholder="0"
        prefix="₱"
        big
        autoFocus
        style={{ marginTop: space.xl }}
      />
      {suggest ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T v="strong">Use last count?</T>
            <T v="caption">You counted {peso(suggest.cash)} when you closed {short(suggest.date)}.</T>
          </View>
          <Button small kind="ghost" label="Use" onPress={() => setText(centsToInput(suggest.cash))} />
        </Card>
      ) : null}
    </Screen>
  );
}
