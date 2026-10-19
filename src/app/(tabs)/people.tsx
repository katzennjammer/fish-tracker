import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Empty, IconButton, Money, PageHeader, Screen, Segmented, T } from '../../components/ui';
import { Icon } from '../../components/icons';
import { listPeople, type PersonKind, type PersonSummary } from '../../lib/db';
import { useQuery } from '../../lib/useQuery';
import { peso } from '../../lib/format';
import { ago, daysBetween, short, today } from '../../lib/dates';
import { color, font, space } from '../../lib/theme';

type Sort = 'owed' | 'late' | 'name';

export default function PeopleScreen() {
  const [kind, setKind] = useState<PersonKind>('customer');
  const [sort, setSort] = useState<Sort>('owed');
  const [q, setQ] = useState('');
  const people = useQuery(() => listPeople(kind), [kind]);
  const isCustomer = kind === 'customer';

  const shown = useMemo(() => {
    if (!people) return [];
    const s = q.trim().toLowerCase();
    let list = s ? people.filter((p) => p.name.toLowerCase().includes(s)) : people;
    if (!s) list = list.filter((p) => p.balance !== 0 || sort === 'name');
    const quiet = (p: PersonSummary) => daysBetween(p.last_payment ?? p.first_credit ?? today(), today());
    return [...list].sort((a, b) =>
      sort === 'owed' ? b.balance - a.balance : sort === 'late' ? quiet(b) - quiet(a) : a.name.localeCompare(b.name),
    );
  }, [people, q, sort]);

  const total = people?.reduce((a, p) => a + Math.max(p.balance, 0), 0) ?? 0;
  const count = people?.filter((p) => p.balance > 0).length ?? 0;
  const settled = (people?.length ?? 0) - count;

  return (
    <Screen>
      <PageHeader
        eyebrow="Utang list"
        title={isCustomer ? 'Who owes me' : 'Who I owe'}
        right={<IconButton icon="plus" tone="sea" label="Add person" onPress={() => router.push({ pathname: '/person/edit', params: { kind } })} />}
      />
      <Segmented<PersonKind>
        value={kind}
        onChange={setKind}
        options={[{ value: 'customer', label: 'Customers' }, { value: 'supplier', label: 'Suppliers' }]}
      />

      <View style={[styles.summary, { backgroundColor: isCustomer ? color.redTint : color.brassTint }]}>
        <T v="label" c={isCustomer ? color.red : color.brass}>{isCustomer ? 'Total owed to you' : 'Total you owe'}</T>
        <Money cents={total} size={38} c={isCustomer ? color.red : color.brass} style={{ marginTop: 4 }} />
        <T v="caption" style={{ marginTop: 2 }}>
          {count} {count === 1 ? 'person' : 'people'} with balance{settled > 0 ? ` · ${settled} settled` : ''}
        </T>
      </View>

      <View style={styles.search}>
        <Icon name="search" size={18} color={color.inkSoft} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name"
          placeholderTextColor={color.inkFaint}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.sorts}>
        {(['owed', 'late', 'name'] as Sort[]).map((s) => (
          <Pressable key={s} onPress={() => setSort(s)} style={[styles.sort, sort === s && styles.sortOn]}>
            <T v="caption" c={sort === s ? color.seaText : color.inkSoft} style={{ fontFamily: font.medium }}>
              {s === 'owed' ? 'Biggest' : s === 'late' ? 'Longest unpaid' : 'A–Z (all)'}
            </T>
          </Pressable>
        ))}
      </View>

      {people && shown.length === 0 ? (
        <Card>
          <Empty
            icon="people"
            title={q ? 'No match' : isCustomer ? 'No one owes you' : 'You owe no one'}
            body={
              q
                ? 'Try another spelling.'
                : isCustomer
                  ? 'When you sell on utang, the customer appears here with their balance.'
                  : 'When you buy stock on credit, the supplier appears here.'
            }
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {shown.map((p, i) => (
            <PersonRow key={p.id} p={p} last={i === shown.length - 1} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

function PersonRow({ p, last }: { p: PersonSummary; last: boolean }) {
  const isCustomer = p.kind === 'customer';
  const quietDays = p.balance > 0 ? daysBetween(p.last_payment ?? p.first_credit ?? today(), today()) : 0;
  const late = isCustomer && quietDays >= 14;
  let sub: string;
  if (p.balance <= 0) sub = p.balance < 0 ? `Overpaid ${peso(-p.balance)}` : 'Fully paid';
  else if (p.last_payment) sub = `Last paid ${ago(p.last_payment)}`;
  else sub = `Unpaid since ${short(p.first_credit ?? today())}`;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/person/[id]', params: { id: String(p.id) } })}
      style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && { backgroundColor: color.sunk }]}
    >
      <View style={[styles.avatar, late && { backgroundColor: color.red }]}>
        <T v="strong" c={color.seaText}>{p.name.slice(0, 1).toUpperCase()}</T>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="strong" numberOfLines={1}>{p.name}</T>
        <T v="caption" c={late ? color.red : color.inkSoft} numberOfLines={1}>{sub}</T>
      </View>
      <T
        v="heading"
        c={p.balance > 0 ? (isCustomer ? color.red : color.brass) : color.green}
        style={{ fontFamily: font.display, fontSize: 19, fontVariant: ['tabular-nums'] }}
      >
        {p.balance === 0 ? '✓' : peso(Math.abs(p.balance))}
      </T>
      <Icon name="chevronRight" size={16} color={color.inkFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: 18, padding: 18, marginTop: space.lg },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.lg, paddingHorizontal: 14,
    backgroundColor: color.card, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line,
  },
  searchInput: { flex: 1, fontFamily: font.medium, fontSize: 16, color: color.ink, paddingVertical: 12 },
  sorts: { flexDirection: 'row', gap: 8, marginVertical: space.md },
  sort: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: color.line },
  sortOn: { backgroundColor: color.ink, borderColor: color.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineSoft },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: color.sea, alignItems: 'center', justifyContent: 'center',
  },
});
