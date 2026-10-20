import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Button, DateStepper, Field, Screen, Segmented, SheetHeader, T, done } from '../components/ui';
import { PersonPicker } from '../components/pickers';
import { addBalance, getPerson, type PersonKind } from '../lib/db';
import { useQuery } from '../lib/useQuery';
import { parseAmount, peso, toCents } from '../lib/format';
import { today } from '../lib/dates';
import { color, space } from '../lib/theme';

/** Utang from before the app: an amount and the date it started, no fish. */
export default function OldBalanceScreen() {
  const params = useLocalSearchParams<{ personId?: string; kind?: PersonKind }>();
  const fixed = params.personId ? Number(params.personId) : null;
  const [kind, setKind] = useState<PersonKind>(params.kind ?? 'customer');
  const [personId, setPersonId] = useState<number | null>(fixed);
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const person = useQuery(() => (fixed ? getPerson(fixed) : Promise.resolve(null)), [fixed]);

  const amount = toCents(parseAmount(amountText) ?? 0);
  const whoKind = person?.kind ?? kind;
  const isCustomer = whoKind === 'customer';

  async function save() {
    setTried(true);
    if (!personId || !amount) return;
    setBusy(true);
    try {
      await addBalance({ date, personId, amount, kind: 'old', note: note.trim() });
      done('Old balance saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button label={`Save old balance${amount ? ` · ${peso(amount)}` : ''}`} icon="check" onPress={save} disabled={busy} />}>
      <SheetHeader
        title="Old balance"
        subtitle={
          person
            ? isCustomer
              ? `What ${person.name} already owed before you used this app.`
              : `What you already owed ${person.name} before you used this app.`
            : 'Utang from before you used this app. No fish needed.'
        }
      />

      {!fixed ? (
        <>
          <Segmented<PersonKind>
            value={kind}
            onChange={(k) => { setKind(k); setPersonId(null); }}
            options={[{ value: 'customer', label: 'A customer owes me' }, { value: 'supplier', label: 'I owe a supplier' }]}
          />
          <T v="label" style={{ marginTop: space.xl, marginBottom: 10 }}>{isCustomer ? 'Customer' : 'Supplier'}</T>
          <PersonPicker kind={kind} value={personId} onChange={setPersonId} required={tried} />
          {tried && !personId ? <T v="caption" c={color.red} style={{ marginTop: 6 }}>Choose who</T> : null}
        </>
      ) : null}

      <Field
        label={isCustomer ? 'How much they owe' : 'How much you owe'}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        placeholder="0"
        prefix="₱"
        big
        autoFocus={!!fixed}
        style={{ marginTop: space.xl }}
        error={tried && !amount ? 'Enter how much' : undefined}
      />

      <T v="label" style={{ marginBottom: 10 }}>Since when</T>
      <DateStepper value={date} onChange={setDate} />
      <T v="caption" style={{ marginTop: 6 }}>Tap the date to pick from a calendar.</T>

      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. from the old notebook" style={{ marginTop: space.xl }} />
    </Screen>
  );
}
