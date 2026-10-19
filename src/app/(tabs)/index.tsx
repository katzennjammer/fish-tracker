import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Card, confirm, DateStepper, Empty, LedgerLine, Money, Screen, Section, T, Tag } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { PaalalaCard } from '../../components/Isay';
import { greeting } from '../../lib/tips';
import { dayActivity, daySummary, deleteEntry, getSetting, upcomingDues, type Activity } from '../../lib/db';
import { useQuery } from '../../lib/useQuery';
import { kg, peso } from '../../lib/format';
import { longParts, relativeDay, short, today } from '../../lib/dates';
import { color, font, space } from '../../lib/theme';

export default function TodayScreen() {
  const [date, setDate] = useState(today());
  const summary = useQuery(() => daySummary(date), [date]);
  const activity = useQuery(() => dayActivity(date), [date]);
  const owner = useQuery(() => getSetting('owner_name'), []);
  const dues = useQuery(() => upcomingDues(2), []);
  const isToday = date === today();
  const parts = longParts(date);

  const go = (path: string) => router.push({ pathname: path as never, params: { date } });

  return (
    <Screen>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <T v="label">{parts.weekday} · {parts.date}</T>
          <Text style={styles.hello}>
            {greeting()},{' '}
            <Text style={styles.helloName}>{owner || 'Ma'}</Text>!
          </Text>
        </View>
      </View>
      <PaalalaCard />
      <View style={{ height: space.lg }} />
      <DateStepper value={date} onChange={setDate} />

      {dues && dues.length > 0 && isToday ? (
        <Card onPress={() => router.push('/loans')} style={styles.dueBanner}>
          <Icon name="bell" size={20} color={color.brass} />
          <View style={{ flex: 1 }}>
            <T v="strong">{dues.length === 1 ? `${dues[0].lender} due ${dueWord(dues[0].due_date)}` : `${dues.length} loan payments due soon`}</T>
            <T v="caption">{peso(dues.reduce((a, d) => a + d.amount, 0))} · tap to see loans</T>
          </View>
          <Icon name="chevronRight" size={18} color={color.inkSoft} />
        </Card>
      ) : null}

      {summary ? (
        summary.opened || summary.salesTotal > 0 || summary.expenses > 0 ? (
          <View style={styles.hero}>
            <View style={styles.heroHead}>
              <T v="label" c={color.seaMuted}>{summary.closed ? 'Cash counted' : 'Cash in hand'}</T>
              <Pressable onPress={() => go('/capital')} hitSlop={10}>
                <T v="caption" c={color.seaMuted} style={{ textDecorationLine: 'underline' }}>Edit capital</T>
              </Pressable>
            </View>
            <Money cents={summary.closed && summary.counted !== null ? summary.counted : summary.expected} size={46} c={color.seaText} />
            {summary.closed && summary.counted !== null ? (
              <Difference counted={summary.counted} expected={summary.expected} />
            ) : (
              <T v="caption" c={color.seaMuted} style={{ marginTop: 2 }}>What should be in your box right now</T>
            )}
            <View style={styles.heroRule} />
            <LedgerLine dim label="Capital this morning" value={peso(summary.opening)} />
            <LedgerLine dim label="+ Cash from sales" value={peso(summary.cashSales)} />
            {summary.collections ? <LedgerLine dim label="+ Utang collected" value={peso(summary.collections)} /> : null}
            {summary.stockPaid ? <LedgerLine dim label="− Fish bought" value={peso(summary.stockPaid)} /> : null}
            {summary.supplierPayments ? <LedgerLine dim label="− Paid to suppliers" value={peso(summary.supplierPayments)} /> : null}
            {summary.expenses ? <LedgerLine dim label="− Expenses" value={peso(summary.expenses)} /> : null}
          </View>
        ) : (
          <Pressable onPress={() => go('/capital')} style={({ pressed }) => [styles.hero, pressed && { opacity: 0.92 }]}>
            <T v="label" c={color.seaMuted}>Start the day</T>
            <T v="title" c={color.seaText} style={{ marginTop: 8, fontSize: 28, lineHeight: 34 }}>
              {isToday ? 'How much capital do you have today?' : `No capital recorded for ${short(date)}`}
            </T>
            <View style={styles.heroCta}>
              <T v="strong" c={color.sea}>Set capital</T>
              <Icon name="chevronRight" size={18} color={color.sea} strokeWidth={2.2} />
            </View>
          </Pressable>
        )
      ) : (
        <View style={[styles.hero, { height: 220 }]} />
      )}

      {summary ? (
        <View style={styles.stats}>
          <Stat label="Sales" value={peso(summary.salesTotal)} />
          <Stat label="Sold" value={kg(summary.kgSold)} />
          <Stat label="On credit" value={peso(summary.creditSales)} tone={summary.creditSales ? color.red : undefined} last />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Action icon="fish" label="Sell fish" primary onPress={() => go('/sale')} />
        <Action icon="box" label="Buy stock" onPress={() => go('/purchase')} />
      </View>
      <View style={[styles.actions, { marginTop: 10 }]}>
        <Action icon="in" label="Got payment" onPress={() => go('/payment')} />
        <Action icon="receipt" label="Expense" onPress={() => go('/expense')} />
        <Action icon="trash" label="Spoiled" onPress={() => go('/spoilage')} />
      </View>

      <Section
        title={isToday ? 'Today’s entries' : `Entries · ${relativeDay(date) ?? short(date)}`}
        right={activity && activity.length ? <T v="caption">Hold to delete</T> : null}
      >
        {activity && activity.length ? (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {activity.map((a, i) => (
              <ActivityRow key={`${a.table}-${a.id}`} a={a} last={i === activity.length - 1} />
            ))}
          </Card>
        ) : activity ? (
          <Card>
            <Empty icon="leaf" title="Nothing recorded yet" body="Every sale, payment and expense you add today will be listed here." />
          </Card>
        ) : null}
      </Section>

      {summary && (summary.salesTotal > 0 || summary.opened) ? (
        <Card onPress={() => go('/close-day')} style={styles.close}>
          <View style={styles.closeIcon}>
            <Icon name={summary.closed ? 'check' : 'cash'} size={22} color={summary.closed ? color.green : color.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="strong">{summary.closed ? 'Day closed' : 'Close the day'}</T>
            <T v="caption">{summary.closed ? 'Tap to recount or reopen' : 'Count your cash and check it matches'}</T>
          </View>
          <Icon name="chevronRight" size={18} color={color.inkSoft} />
        </Card>
      ) : null}
    </Screen>
  );
}

function dueWord(date: string) {
  const r = relativeDay(date);
  if (r) return r.toLowerCase();
  return date < today() ? `since ${short(date)} (late)` : short(date);
}

function Difference({ counted, expected }: { counted: number; expected: number }) {
  const diff = counted - expected;
  if (diff === 0) return <T v="caption" c={color.seaMuted} style={{ marginTop: 2 }}>Matches what was expected ✓</T>;
  return (
    <T v="caption" c={diff > 0 ? '#9FD9C1' : '#F0A58F'} style={{ marginTop: 2 }}>
      {diff > 0 ? `${peso(diff)} more than expected` : `${peso(-diff)} short of ${peso(expected)} expected`}
    </T>
  );
}

function Stat({ label, value, tone, last }: { label: string; value: string; tone?: string; last?: boolean }) {
  return (
    <View style={[styles.stat, last && { borderRightWidth: 0 }]}>
      <T v="label" style={{ fontSize: 10.5 }}>{label}</T>
      <T v="heading" c={tone} style={{ marginTop: 3, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{value}</T>
    </View>
  );
}

function Action({ icon, label, onPress, primary }: { icon: IconName; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, primary && styles.actionPrimary, pressed && { opacity: 0.85 }]}
    >
      <Icon name={icon} size={primary ? 24 : 21} color={primary ? color.seaText : color.ink} strokeWidth={2} />
      <T v="strong" c={primary ? color.seaText : color.ink} style={primary ? { fontSize: 17 } : { fontSize: 14.5 }}>{label}</T>
    </Pressable>
  );
}

function ActivityRow({ a, last }: { a: Activity; last: boolean }) {
  const sign = a.flow === 1 ? '+' : a.flow === -1 ? '−' : '';
  const amountColor = a.flow === 1 ? color.green : a.flow === -1 ? color.ink : color.inkSoft;
  let detail = a.detail;
  if ((a.table === 'sales' || a.table === 'purchases') && a.kg !== null && a.price !== null) {
    detail = `${kg(a.kg)} × ${peso(a.price)} · ${a.detail}`;
  }
  if (a.table === 'spoilage' && a.kg !== null) detail = `${kg(a.kg)} · ${a.detail}`;

  let tag: React.ReactNode = null;
  if ((a.table === 'sales' || a.table === 'purchases') && a.paid !== null && a.paid < a.amount) {
    tag = a.paid === 0 ? <Tag label="CREDIT" tone="red" /> : <Tag label={`PAID ${peso(a.paid)}`} tone="brass" />;
  }

  async function remove() {
    const ok = await confirm('Delete this entry?', `${a.title} — ${peso(a.amount)}. This cannot be undone.`);
    if (ok) await deleteEntry(a.table, a.id);
  }

  return (
    <Pressable onLongPress={remove} style={({ pressed }) => [styles.entry, !last && styles.entryLine, pressed && { backgroundColor: color.sunk }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="strong" numberOfLines={1}>{a.title}</T>
        <T v="caption" numberOfLines={1}>{detail}</T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {a.table === 'spoilage' ? null : (
          <T v="strong" c={amountColor} style={{ fontVariant: ['tabular-nums'], fontFamily: font.semibold }}>
            {sign}{peso(a.amount)}
          </T>
        )}
        {tag}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-end' },
  hello: { fontFamily: font.display, fontSize: 31, lineHeight: 37, color: color.ink, letterSpacing: -0.5, marginTop: 4 },
  helloName: { fontFamily: font.displayBold, color: color.sea },
  dueBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: space.md,
    backgroundColor: color.brassTint, borderColor: '#E3D2A6',
  },
  hero: {
    backgroundColor: color.sea, borderRadius: 22, padding: 20, marginTop: space.md, overflow: 'hidden',
  },
  heroHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  heroRule: { height: 1, backgroundColor: color.seaSoft, marginVertical: 14 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 20,
    backgroundColor: color.seaText, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
  },
  stats: {
    flexDirection: 'row', marginTop: space.md, backgroundColor: color.card, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: color.line,
  },
  stat: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: color.lineSoft },
  actions: { flexDirection: 'row', gap: 10, marginTop: space.xl },
  action: {
    flex: 1, minHeight: 64, borderRadius: 16, backgroundColor: color.card, borderWidth: 1, borderColor: color.line,
    alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10,
  },
  actionPrimary: { backgroundColor: color.green, borderColor: color.green, flexDirection: 'row', gap: 10, minHeight: 64 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  entryLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineSoft },
  close: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: space.xl },
  closeIcon: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: color.sunk, alignItems: 'center', justifyContent: 'center',
  },
});
