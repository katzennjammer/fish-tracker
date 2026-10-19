import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Button, DateStepper, Field, Screen, SheetHeader, T, done } from '../components/ui';
import { FishPicker } from '../components/pickers';
import { addSpoilage, type FishWithStock } from '../lib/db';
import { parseAmount } from '../lib/format';
import { today } from '../lib/dates';
import { color, space } from '../lib/theme';

/** Fish that went bad or was given away — it leaves stock without money. */
export default function SpoilageScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const [date, setDate] = useState(params.date ?? today());
  const [fish, setFish] = useState<FishWithStock | null>(null);
  const [kgText, setKgText] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const kg = parseAmount(kgText);

  async function save() {
    setTried(true);
    if (!fish || !kg) return;
    setBusy(true);
    try {
      await addSpoilage({ date, fishId: fish.id, kg, note: note.trim() });
      done();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button label="Save" onPress={save} disabled={busy} />}>
      <SheetHeader title="Spoiled or lost" subtitle="Fish that can no longer be sold. It is counted as a loss in reports." />
      <DateStepper value={date} onChange={setDate} />
      <T v="label" style={{ marginTop: space.xl, marginBottom: 10 }}>Which fish</T>
      <FishPicker value={fish?.id ?? null} onChange={setFish} priceOf="buy_price" />
      {tried && !fish ? <T v="caption" c={color.red} style={{ marginTop: 6 }}>Pick a fish</T> : null}
      <Field
        label="Kilos"
        value={kgText}
        onChangeText={setKgText}
        keyboardType="decimal-pad"
        placeholder="0"
        suffix="kg"
        big
        style={{ marginTop: space.xl }}
        error={tried && !kg ? 'Enter the kilos' : undefined}
      />
      <Field label="Reason (optional)" value={note} onChangeText={setNote} placeholder="e.g. no ice, gave to neighbor" />
    </Screen>
  );
}
