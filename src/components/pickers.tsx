import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Chip, T } from './ui';
import { Icon } from './icons';
import { listFish, listPeople, savePerson, type FishWithStock, type PersonKind } from '../lib/db';
import { useQuery } from '../lib/useQuery';
import { kg, peso } from '../lib/format';
import { color, font } from '../lib/theme';

export function FishPicker({
  value, onChange, priceOf,
}: { value: number | null; onChange: (f: FishWithStock) => void; priceOf: 'sell_price' | 'buy_price' }) {
  const fish = useQuery(() => listFish(), []);
  if (!fish) return null;
  return (
    <View style={styles.wrap}>
      {fish.map((f) => {
        const price = f[priceOf];
        const tracked = f.bought > 0;
        const sub = [price ? `${peso(price)}/kg` : null, tracked ? `${kg(Math.max(f.stock, 0))} left` : null]
          .filter(Boolean)
          .join(' · ');
        return <Chip key={f.id} label={f.name} sub={sub || 'set price'} on={value === f.id} onPress={() => onChange(f)} />;
      })}
      <Pressable onPress={() => router.push('/fish/edit')} style={styles.addChip}>
        <Icon name="plus" size={18} color={color.inkSoft} />
        <T v="caption" style={{ fontFamily: font.medium }}>New fish</T>
      </Pressable>
    </View>
  );
}

/**
 * Pick an existing customer/supplier or create one by typing a new name.
 * Keeps the list inline so it works the same on every phone.
 */
export function PersonPicker({
  kind, value, onChange, required,
}: { kind: PersonKind; value: number | null; onChange: (id: number | null) => void; required?: boolean }) {
  const people = useQuery(() => listPeople(kind), [kind]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = people?.find((p) => p.id === value) ?? null;
  const noun = kind === 'customer' ? 'customer' : 'supplier';

  const matches = useMemo(() => {
    if (!people) return [];
    const s = q.trim().toLowerCase();
    const list = s ? people.filter((p) => p.name.toLowerCase().includes(s)) : people;
    return [...list].sort((a, b) => b.balance - a.balance).slice(0, 8);
  }, [people, q]);
  const exact = people?.some((p) => p.name.toLowerCase() === q.trim().toLowerCase());

  async function create() {
    const name = q.trim();
    if (!name) return;
    const id = await savePerson({ name, phone: '', kind, note: '' });
    onChange(id);
    setQ('');
    setOpen(false);
  }

  if (selected && !open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={[styles.box, styles.selected]}>
        <View style={styles.avatar}>
          <T v="strong" c={color.seaText}>{selected.name.slice(0, 1).toUpperCase()}</T>
        </View>
        <View style={{ flex: 1 }}>
          <T v="strong">{selected.name}</T>
          <T v="caption">{selected.balance > 0 ? `${kind === 'customer' ? 'Owes' : 'You owe'} ${peso(selected.balance)} now` : 'No balance'}</T>
        </View>
        <T v="caption" style={{ textDecorationLine: 'underline' }}>Change</T>
      </Pressable>
    );
  }

  return (
    <View style={[styles.box, required && !value ? { borderColor: color.red } : null]}>
      <View style={styles.search}>
        <Icon name="search" size={18} color={color.inkSoft} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onFocus={() => setOpen(true)}
          placeholder={`Search or type a new ${noun}`}
          placeholderTextColor={color.inkFaint}
          style={styles.searchInput}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => (!exact && q.trim() ? create() : undefined)}
        />
        {value ? (
          <Pressable onPress={() => { onChange(null); setOpen(false); }} hitSlop={10}>
            <T v="caption">Clear</T>
          </Pressable>
        ) : null}
      </View>
      {q.trim() && !exact ? (
        <Pressable onPress={create} style={styles.option}>
          <Icon name="plus" size={18} color={color.green} strokeWidth={2.2} />
          <T v="strong" c={color.green}>Add “{q.trim()}” as new {noun}</T>
        </Pressable>
      ) : null}
      {matches.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => { onChange(p.id); setOpen(false); setQ(''); }}
          style={({ pressed }) => [styles.option, pressed && { backgroundColor: color.sunk }]}
        >
          <T v="body" style={{ flex: 1 }}>{p.name}</T>
          {p.balance > 0 ? <T v="caption" c={kind === 'customer' ? color.red : color.brass}>{peso(p.balance)}</T> : null}
        </Pressable>
      ))}
      {people && people.length === 0 && !q ? (
        <T v="caption" style={{ padding: 14 }}>No {noun}s yet. Type a name above to add one.</T>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 50,
    borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: color.inkFaint,
  },
  box: {
    borderRadius: 14, borderWidth: 1, borderColor: color.line, backgroundColor: color.card, overflow: 'hidden',
  },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: color.sea, alignItems: 'center', justifyContent: 'center',
  },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line,
  },
  searchInput: { flex: 1, fontFamily: font.medium, fontSize: 16, color: color.ink, paddingVertical: 13 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineSoft,
  },
});
