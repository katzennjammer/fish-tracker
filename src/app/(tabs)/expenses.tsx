import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Card, confirm, Empty, IconButton, Money, PageHeader, Screen, Section, T } from '../../components/ui';
import { PeriodBar } from '../../components/PeriodBar';
import { deleteEntry, listExpenses, type Expense } from '../../lib/db';
import { useQuery } from '../../lib/useQuery';
import { peso } from '../../lib/format';
import { daysBetween, periodRange, relativeDay, short, today, type Period } from '../../lib/dates';
import { color, font, space } from '../../lib/theme';

export default function ExpensesScreen() {
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState(today());
  const [start, end] = periodRange(period, anchor);
  const expenses = useQuery(() => listExpenses(start, end), [start, end]);

  const total = expenses?.reduce((a, e) => a + e.amount, 0) ?? 0;
  const byCat = new Map<string, number>();
  expenses?.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount));
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const top = cats[0]?.[1] ?? 1;

  const elapsed = Math.max(1, Math.min(daysBetween(start, today()), daysBetween(start, end)) + 1);
  const perDay = period === 'day' ? null : Math.round(total / elapsed);

  const groups: { date: string; items: Expense[] }[] = [];
  expenses?.forEach((e) => {
    const g = groups[groups.length - 1];
    if (g && g.date === e.date) g.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  });

  return (
    <Screen>
      <PageHeader
        eyebrow="Gastos"
        title="Expenses"
        right={<IconButton icon="plus" tone="sea" label="Add expense" onPress={() => router.push('/expense')} />}
      />
      <PeriodBar period={period} anchor={anchor} onPeriod={setPeriod} onAnchor={setAnchor} />

      <Card style={{ marginTop: space.lg }}>
        <T v="label">Spent</T>
        <Money cents={total} size={40} style={{ marginTop: 4 }} />
        {perDay !== null && total > 0 ? <T v="caption">About {peso(perDay)} a day</T> : null}
        {cats.length > 0 ? (
          <View style={{ marginTop: space.lg, gap: 12 }}>
            {cats.map(([cat, amount]) => (
              <View key={cat}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                  <T v="body" style={{ fontSize: 15 }}>{cat}</T>
                  <T v="strong" style={{ fontSize: 15, fontVariant: ['tabular-nums'] }}>{peso(amount)}</T>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max((amount / top) * 100, 2)}%` }]} />
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Section title="Entries" right={groups.length ? <T v="caption">Hold to delete</T> : null}>
        {expenses && expenses.length === 0 ? (
          <Card>
            <Empty icon="receipt" title="No expenses" body="Ice, transport, bags, rent — add them so you see your real profit." />
          </Card>
        ) : (
          groups.map((g) => (
            <View key={g.date} style={{ marginBottom: space.md }}>
              <T v="caption" style={{ marginBottom: 6, fontFamily: font.medium }}>
                {relativeDay(g.date) ? `${relativeDay(g.date)} · ${short(g.date)}` : short(g.date, true)}
              </T>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {g.items.map((e, i) => (
                  <ExpenseRow key={e.id} e={e} last={i === g.items.length - 1} />
                ))}
              </Card>
            </View>
          ))
        )}
      </Section>
    </Screen>
  );
}

function ExpenseRow({ e, last }: { e: Expense; last: boolean }) {
  async function remove() {
    if (await confirm('Delete this expense?', `${e.category} — ${peso(e.amount)}`)) await deleteEntry('expenses', e.id);
  }
  return (
    <Pressable
      onLongPress={remove}
      style={({ pressed }) => [styles.row, !last && styles.line, pressed && { backgroundColor: color.sunk }]}
    >
      <View style={{ flex: 1 }}>
        <T v="strong">{e.category}</T>
        {e.note ? <T v="caption" numberOfLines={1}>{e.note}</T> : null}
      </View>
      <T v="strong" style={{ fontVariant: ['tabular-nums'] }}>{peso(e.amount)}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, backgroundColor: color.sunk, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: color.brass },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineSoft },
});
