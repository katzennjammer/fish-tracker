import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Card, DateStepper, Empty, IconButton, PageHeader, Screen, Section, T } from '../../components/ui';
import { Icon } from '../../components/icons';
import { fishAudit, listFish, type FishDay } from '../../lib/db';
import { useQuery } from '../../lib/useQuery';
import { kg, peso } from '../../lib/format';
import { today } from '../../lib/dates';
import { color, font, space } from '../../lib/theme';

export default function FishScreen() {
  const [date, setDate] = useState(today());
  const audit = useQuery(() => fishAudit(date), [date]);
  const fish = useQuery(() => listFish(), []);
  const moved = audit?.filter((f) => f.bought || f.sold || f.spoiled) ?? [];
  const totalSales = moved.reduce((a, f) => a + f.sales, 0);
  const totalKg = moved.reduce((a, f) => a + f.sold, 0);

  return (
    <Screen>
      <PageHeader
        eyebrow="Fish & prices"
        title="Fish audit"
        right={<IconButton icon="plus" tone="sea" label="New fish" onPress={() => router.push('/fish/edit')} />}
      />
      <DateStepper value={date} onChange={setDate} />

      <Section
        title="Movement for the day"
        right={moved.length ? <T v="caption">{kg(totalKg)} · {peso(totalSales)}</T> : null}
        style={{ marginTop: space.lg }}
      >
        {audit && moved.length === 0 ? (
          <Card>
            <Empty icon="fish" title="No fish moved" body="Record stock you bought and fish you sold, and each fish's kilos will be tallied here." />
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {moved.map((f, i) => (
              <AuditRow key={f.id} f={f} last={i === moved.length - 1} />
            ))}
          </Card>
        )}
      </Section>

      <Section title="Price list" right={<T v="caption">Tap to edit</T>}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <View style={[styles.priceHead]}>
            <T v="label" style={{ flex: 1 }}>Fish</T>
            <T v="label" style={styles.col}>Buy</T>
            <T v="label" style={styles.col}>Sell</T>
            <T v="label" style={styles.col}>Gain</T>
          </View>
          {fish?.map((f, i) => {
            const gain = f.sell_price && f.buy_price ? f.sell_price - f.buy_price : null;
            return (
              <Pressable
                key={f.id}
                onPress={() => router.push({ pathname: '/fish/[id]', params: { id: String(f.id) } })}
                style={({ pressed }) => [styles.priceRow, i < fish.length - 1 && styles.line, pressed && { backgroundColor: color.sunk }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="strong" numberOfLines={1}>{f.name}</T>
                  {f.bought > 0 ? <T v="caption">{kg(Math.max(f.stock, 0))} in stock</T> : null}
                </View>
                <T v="body" style={styles.col} c={f.buy_price ? color.ink : color.inkFaint}>{f.buy_price ? peso(f.buy_price) : '—'}</T>
                <T v="body" style={styles.col} c={f.sell_price ? color.ink : color.inkFaint}>{f.sell_price ? peso(f.sell_price) : '—'}</T>
                <T v="body" style={[styles.col, { fontFamily: font.semibold }]} c={gain === null ? color.inkFaint : gain >= 0 ? color.green : color.red}>
                  {gain === null ? '—' : peso(gain)}
                </T>
              </Pressable>
            );
          })}
        </Card>
        <T v="caption" style={{ marginTop: 8 }}>Prices are per kilo. They update to the last price you used.</T>
      </Section>
    </Screen>
  );
}

function AuditRow({ f, last }: { f: FishDay; last: boolean }) {
  // Stock at the start of the day = what is left now + what moved out − what came in.
  const start = f.stock + f.sold + f.spoiled - f.bought;
  const available = Math.max(start + f.bought, 0);
  const soldShare = available > 0 ? Math.min(f.sold / available, 1) : f.sold > 0 ? 1 : 0;
  const spoilShare = available > 0 ? Math.min(f.spoiled / available, 1 - soldShare) : 0;
  const tracked = !!f.tracked;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/fish/[id]', params: { id: String(f.id) } })}
      style={({ pressed }) => [styles.audit, !last && styles.line, pressed && { backgroundColor: color.sunk }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <T v="strong" style={{ flex: 1 }}>{f.name}</T>
        <T v="strong" style={{ fontVariant: ['tabular-nums'] }}>{peso(f.sales)}</T>
      </View>
      {tracked ? (
        <View style={styles.bar}>
          <View style={{ flex: soldShare, backgroundColor: color.green }} />
          <View style={{ flex: spoilShare, backgroundColor: color.red }} />
          <View style={{ flex: Math.max(1 - soldShare - spoilShare, 0), backgroundColor: color.sunk }} />
        </View>
      ) : null}
      <View style={styles.nums}>
        {f.bought ? <Num label="Bought" value={kg(f.bought)} /> : null}
        <Num label="Sold" value={kg(f.sold)} c={color.green} />
        {f.spoiled ? <Num label="Spoiled" value={kg(f.spoiled)} c={color.red} /> : null}
        {tracked ? <Num label="Left" value={kg(Math.max(f.stock, 0))} /> : null}
      </View>
      {tracked && f.stock < -0.001 ? (
        <View style={styles.warn}>
          <Icon name="alert" size={14} color={color.brass} />
          <T v="caption" c={color.brass}>Sold more than recorded stock — a purchase may be missing.</T>
        </View>
      ) : null}
    </Pressable>
  );
}

function Num({ label, value, c }: { label: string; value: string; c?: string }) {
  return (
    <View>
      <T v="caption" style={{ fontSize: 12 }}>{label}</T>
      <T v="strong" c={c} style={{ fontSize: 14.5, fontVariant: ['tabular-nums'] }}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineSoft },
  audit: { paddingHorizontal: 16, paddingVertical: 14 },
  bar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 10 },
  nums: { flexDirection: 'row', gap: 22, marginTop: 10 },
  warn: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8 },
  priceHead: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: color.sunk,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  col: { width: 68, textAlign: 'right', fontVariant: ['tabular-nums'], fontSize: 14.5 },
});
