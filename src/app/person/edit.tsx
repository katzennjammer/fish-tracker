import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, confirm, DateStepper, Field, Screen, Segmented, SheetHeader, T, done } from '../../components/ui';
import { addBalance, deletePerson, getPerson, savePerson, type PersonKind } from '../../lib/db';
import { parseAmount, toCents } from '../../lib/format';
import { today } from '../../lib/dates';
import { space } from '../../lib/theme';

export default function PersonEditScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: PersonKind }>();
  const id = params.id ? Number(params.id) : undefined;
  const [kind, setKind] = useState<PersonKind>(params.kind ?? 'customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [oldText, setOldText] = useState('');
  const [oldDate, setOldDate] = useState(today());

  useEffect(() => {
    if (!id) return;
    getPerson(id).then((p) => {
      if (!p) return;
      setKind(p.kind);
      setName(p.name);
      setPhone(p.phone);
      setNote(p.note);
    });
  }, [id]);

  async function save() {
    setTried(true);
    if (!name.trim()) return;
    const saved = await savePerson({ id, name: name.trim(), phone: phone.trim(), kind, note: note.trim() });
    const old = toCents(parseAmount(oldText) ?? 0);
    if (!id && old > 0) await addBalance({ date: oldDate, personId: saved, amount: old, kind: 'old' });
    done('Saved');
  }

  async function remove() {
    if (!id) return;
    const ok = await confirm(
      `Delete ${name}?`,
      'All of their utang and payment records will be deleted too. This cannot be undone.',
    );
    if (!ok) return;
    await deletePerson(id);
    router.dismissAll();
  }

  return (
    <Screen
      footer={
        <>
          <Button label={id ? 'Save changes' : 'Add person'} onPress={save} />
          {id ? <Button label="Delete person" kind="danger" onPress={remove} style={{ marginTop: 10 }} small /> : null}
        </>
      }
    >
      <SheetHeader title={id ? 'Edit person' : 'New person'} />
      {!id ? (
        <Segmented<PersonKind>
          value={kind}
          onChange={setKind}
          options={[{ value: 'customer', label: 'Customer' }, { value: 'supplier', label: 'Supplier' }]}
          style={{ marginBottom: space.xl }}
        />
      ) : null}
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Aling Nena"
        autoCapitalize="words"
        autoFocus={!id}
        error={tried && !name.trim() ? 'Enter a name' : undefined}
      />
      <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="09xx xxx xxxx" />
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. pays every Saturday" multiline />
      {!id ? (
        <Card style={{ marginBottom: space.xl }}>
          <T v="strong">Old balance (optional)</T>
          <T v="caption" style={{ marginBottom: space.lg }}>
            {kind === 'customer'
              ? 'If they already owed you before this app, put it here.'
              : 'If you already owed them before this app, put it here.'}
          </T>
          <Field label="Amount" value={oldText} onChangeText={setOldText} keyboardType="decimal-pad" placeholder="0" prefix="₱" />
          {oldText ? (
            <>
              <T v="label" style={{ marginBottom: 8 }}>Since when</T>
              <DateStepper value={oldDate} onChange={setOldDate} />
            </>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}
