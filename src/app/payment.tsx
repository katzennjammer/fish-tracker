import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Card, DateStepper, Field, LedgerLine, Screen, Segmented, SheetHeader, T, done } from '../components/ui';
import { PersonPicker } from '../components/pickers';
import { addPayment, getPerson, type PersonKind } from '../lib/db';
import { useQuery } from '../lib/useQuery';
import { centsToInput, parseAmount, peso, toCents } from '../lib/format';
import { today } from '../lib/dates';
import { color, space } from '../lib/theme';

/** Money received from a customer, or paid out to a supplier. */
export default function PaymentScreen() {
  const params = useLocalSearchParams<{ date?: string; personId?: string; kind?: PersonKind }>();
  const [kind, setKind] = useState<PersonKind>(params.kind ?? 'customer');
  const [date, setDate] = useState(params.date ?? today());
  const [personId, setPersonId] = useState<number | null>(params.personId ? Number(params.personId) : null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const person = useQuery(() => (personId ? getPerson(personId) : Promise.resolve(null)), [personId]);

  const amount = toCents(parseAmount(amountText) ?? 0);
  const balance = person?.balance ?? 0;
  const after = balance - amount;
  const fixedPerson = !!params.personId;

  async function save() {
    setTried(true);
    if (!personId || !amount) return;
    setBusy(true);
    try {
      await addPayment({ date, personId, amount, note: note.trim() });
      done();
    } finally {
      setBusy(false);
    }
  }

  const isCustomer = (person?.kind ?? kind) === 'customer';

  return (
    <Screen footer={<Button label={isCustomer ? 'Save payment' : 'Save payment out'} onPress={save} disabled={busy} />}>
      <SheetHeader
        title={isCustomer ? 'Got a payment' : 'Paid a supplier'}
        subtitle={isCustomer ? 'A customer paid some or all of their utang.' : 'You paid part of what you owe.'}
      />
      {!fixedPerson ? (
        <Segmented<PersonKind>
          value={kind}
          onChange={(k) => { setKind(k); setPersonId(null); }}
          options={[{ value: 'customer', label: 'From a customer' }, { value: 'supplier', label: 'To a supplier' }]}
          style={{ marginBottom: space.lg }}
        />
      ) : null}
      <DateStepper value={date} onChange={setDate} />

      <T v="label" style={{ marginTop: space.xl, marginBottom: 10 }}>{kind === 'customer' ? 'Who paid' : 'Paid to'}</T>
      <PersonPicker kind={person?.kind ?? kind} value={personId} onChange={setPersonId} required={tried} />

      {person ? (
        <Card style={{ marginTop: space.md }}>
          <LedgerLine label={isCustomer ? 'Owes now' : 'You owe now'} value={peso(balance)} />
          <LedgerLine label="This payment" value={amount ? `− ${peso(amount)}` : '—'} />
          <LedgerLine
            bold
            label={after < 0 ? 'Overpaid by' : 'Balance after'}
            value={peso(Math.abs(after))}
            c={after > 0 ? (isCustomer ? color.red : color.brass) : color.green}
          />
          {balance > 0 ? (
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Button small kind="ghost" label={`Pays all ${peso(balance)}`} onPress={() => setAmountText(centsToInput(balance))} />
            </View>
          ) : null}
        </Card>
      ) : null}

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
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. via GCash" />
    </Screen>
  );
}
