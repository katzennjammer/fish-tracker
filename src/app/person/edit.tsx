import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, confirm, Field, Screen, Segmented, SheetHeader, done } from '../../components/ui';
import { deletePerson, getPerson, savePerson, type PersonKind } from '../../lib/db';
import { space } from '../../lib/theme';

export default function PersonEditScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: PersonKind }>();
  const id = params.id ? Number(params.id) : undefined;
  const [kind, setKind] = useState<PersonKind>(params.kind ?? 'customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

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
    await savePerson({ id, name: name.trim(), phone: phone.trim(), kind, note: note.trim() });
    done();
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
    </Screen>
  );
}
