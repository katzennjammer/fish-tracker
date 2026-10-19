import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Divider, Empty, LedgerLine, Money, PageHeader, Screen, Section, T } from '../components/ui';
import { PeriodBar } from '../components/PeriodBar';
import { report, type Report } from '../lib/db';
import { useQuery } from '../lib/useQuery';
import { kg, peso } from '../lib/format';
import { addDays, daysBetween, parse, periodRange, short, today, type Period } from '../lib/dates';
import { color, font, space } from '../lib/theme';

export default function ReportsScreen() {
  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState(today());
  const [start, end] = periodRange(period, anchor);
  const r = useQuery(() => report(start, end), [start, end]);

  return (
    <Screen>
      <PageHeader back eyebrow="How the business is doing" title="Profit" />
      <PeriodBar period={period} anchor={anchor} onPeriod={setPeriod} onAnchor={setAnchor} />
      {r ? <Body r={r} period={period} start={start} end={end} /> : null}
    </Screen>
  );
}

function Body({ r, period, start, end }: { r: Report; period: Period; start: string; end: string }) {
  const up = r.net >= 0;
  const topMax = r.topFish[0]?.total ?? 1;
  return (
    <>
      <View style={[styles.hero, { backgroundColor: up ? color.green : color.red }]}>
        <T v="label" c="#E3EFE8">{up ? 'Net profit' : 'Net loss'}</T>
        <Money cents={r.net} size={44} c="#FFFFFF" style={{ marginTop: 4 }} />
        <T v="caption" c="#E3EFE8">After fish cost, spoilage and expenses</T>
      </View>

      <Card style={{ marginTop: space.md }}>
        <LedgerLine label="Sales" value={peso(r.revenue)} />
        <LedgerLine label="− Cost of fish sold" value={peso(r.cost)} />
        <Divider style={{ marginVertical: 6 }} />
        <LedgerLine bold label="Gain on fish" value={peso(r.gross)} />
        <LedgerLine label="− Spoiled fish" value={peso(r.spoilageCost)} />
        <LedgerLine label="− Expenses" value={peso(r.expenses)} />
        <Divider style={{ marginVertical: 6 }} />
        <LedgerLine bold label="Net" value={peso(r.net)} c={up ? color.green : color.red} />
        <T v="caption" style={{ marginTop: 10 }}>
          {kg(r.kgSold)} sold · {peso(r.cashIn)} cash actually received (incl. utang collected)
        </T>
      </Card>

      {period !== 'day' ? (
        <Section title="Sales per day">
          <Card>
            <DailyBars daily={r.daily} start={start} end={end} />
          </Card>
        </Section>
      ) : null}

      <Section title="Best sellers">
        {r.topFish.length === 0 ? (
          <Card><Empty icon="fish" title="No sales in this period" body="Sales you record will be ranked here." /></Card>
        ) : (
          <Card>
            {r.topFish.slice(0, 8).map((f, i) => (
              <View key={f.id} style={{ marginBottom: i < Math.min(r.topFish.length, 8) - 1 ? 14 : 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 5 }}>
                  <T v="strong" style={{ flex: 1 }}>{i + 1}. {f.name}</T>
                  <T v="caption" style={{ marginRight: 10 }}>{kg(f.kg)}</T>
                  <T v="strong" style={{ fontVariant: ['tabular-nums'] }}>{peso(f.total)}</T>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max((f.total / topMax) * 100, 2)}%` }]} />
                </View>
              </View>
            ))}
          </Card>
        )}
      </Section>

      {r.expenseByCategory.length ? (
        <Section title="Where expenses went">
          <Card>
            {r.expenseByCategory.map((e) => <LedgerLine key={e.category} label={e.category} value={peso(e.amount)} />)}
          </Card>
        </Section>
      ) : null}

      <Section title="Right now">
        <Card>
          <LedgerLine label="Customers owe you" value={peso(r.receivable)} c={r.receivable ? color.red : undefined} />
          <LedgerLine label="You owe suppliers" value={peso(r.payable)} c={r.payable ? color.brass : undefined} />
          <LedgerLine label="Loans still to pay" value={peso(r.loansLeft)} />
        </Card>
      </Section>
    </>
  );
}

/** One series, so no legend: thin sea bars, tap a bar to read its value. */
function DailyBars({ daily, start, end }: { daily: { date: string; total: number }[]; start: string; end: string }) {
  const [picked, setPicked] = useState<string | null>(null);
  const last = end > today() ? today() : end;
  const span = Math.max(daysBetween(start, last) + 1, 1);
  const map = new Map(daily.map((d) => [d.date, d.total]));
  const days = Array.from({ length: span }, (_, i) => addDays(start, i));
  const max = Math.max(...days.map((d) => map.get(d) ?? 0), 1);
  const best = days.reduce((a, d) => ((map.get(d) ?? 0) > (map.get(a) ?? 0) ? d : a), days[0]);
  const shown = picked ?? best;
  const total = days.reduce((a, d) => a + (map.get(d) ?? 0), 0);

  if (total === 0) return <T v="caption">No sales yet in this period.</T>;

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T v="caption">{picked ? short(shown, true) : `Best day · ${short(shown, true)}`}</T>
        <T v="heading" style={{ fontFamily: font.display, fontSize: 20 }}>{peso(map.get(shown) ?? 0)}</T>
      </View>
      <View style={styles.chart}>
        {days.map((d) => {
          const v = map.get(d) ?? 0;
          const on = d === shown;
          return (
            <Pressable key={d} onPress={() => setPicked(d)} style={styles.slot} hitSlop={{ top: 10, bottom: 10 }}>
              <View
                style={[
                  styles.bar,
                  { height: `${Math.max((v / max) * 100, v ? 3 : 0)}%`, backgroundColor: on ? color.sea : color.seaMuted },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        <T v="caption" style={{ fontSize: 12 }}>{label(start)}</T>
        <T v="caption" style={{ fontSize: 12 }}>{label(last)}</T>
      </View>
    </View>
  );
}

function label(date: string) {
  const d = parse(date);
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, padding: 20, marginTop: space.lg },
  track: { height: 6, borderRadius: 3, backgroundColor: color.sunk, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: color.sea },
  chart: {
    flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 2, marginTop: 12,
    borderBottomWidth: 1, borderBottomColor: color.line,
  },
  slot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4, minWidth: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
});
