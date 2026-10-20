import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, confirm, Empty, LedgerLine, openEntry, PageHeader, Screen, Section, T, Tag, done } from '../../components/ui';
import { fishHistory, getFish, removeFish, setFishArchived, type FishMovement } from '../../lib/db';
import { HistoryCalendar } from '../../components/Calendar';
import { useQuery } from '../../lib/useQuery';
import { kg, peso } from '../../lib/format';
import { short } from '../../lib/dates';
import { color, space } from '../../lib/theme';

export default function FishDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fishId = Number(id);
  const fish = useQuery(() => getFish(fishId), [fishId]);
  const history = useQuery(() => fishHistory(fishId, 1000), [fishId]);
  const [day, setDay] = useState<string | null>(null);

  if (!fish) return <Screen><PageHeader back title={fish === null ? 'Not found' : ''} /></Screen>;

  const gain = fish.sell_price && fish.buy_price ? fish.sell_price - fish.buy_price : null;

  const used = (history?.length ?? 0) > 0;
  const shown = day ? history?.filter((m) => m.date === day) : history?.slice(0, 30);

  async function remove() {
    if (!fish) return;
    if (fish.archived) {
      await setFishArchived(fish.id, false);
      return;
    }
    const ok = await confirm(
      `Remove ${fish.name}?`,
      used
        ? 'It has records, so it will be hidden from the fish list. Its past records stay in the reports.'
        : 'It has no records, so it will be deleted.',
      used ? 'Hide fish' : 'Delete fish',
    );
    if (!ok) return;
    const result = await removeFish(fish.id);
    router.back();
    done(result === 'deleted' ? `${fish.name} deleted` : `${fish.name} hidden`);
  }

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            label={fish.archived ? 'Show again' : used ? 'Hide fish' : 'Delete fish'}
            kind={fish.archived ? 'ghost' : 'danger'}
            icon={fish.archived ? undefined : 'trash'}
            onPress={remove}
            style={{ flex: 1 }}
          />
          <Button
            label="Edit prices"
            icon="edit"
            onPress={() => router.push({ pathname: '/fish/edit', params: { id: String(fish.id) } })}
            style={{ flex: 1.3 }}
          />
        </View>
      }
    >
      <PageHeader back eyebrow={fish.archived ? 'Hidden fish' : 'Fish'} title={fish.name} />
      <Card>
        <LedgerLine label="Selling price" value={fish.sell_price ? `${peso(fish.sell_price)} / kg` : 'Not set'} />
        <LedgerLine label="Buying cost" value={fish.buy_price ? `${peso(fish.buy_price)} / kg` : 'Not set'} />
        <LedgerLine bold label="You gain" value={gain === null ? '—' : `${peso(gain)} / kg`} c={gain === null ? undefined : gain >= 0 ? color.green : color.red} />
      </Card>
      {fish.bought > 0 ? (
        <Card style={{ marginTop: space.md }}>
          <LedgerLine label="Bought (all time)" value={kg(fish.bought)} />
          <LedgerLine label="Sold" value={kg(fish.sold)} />
          <LedgerLine label="Spoiled" value={kg(fish.spoiled)} c={fish.spoiled ? color.red : undefined} />
          <LedgerLine bold label="In stock now" value={kg(Math.max(fish.stock, 0))} />
        </Card>
      ) : null}

      <Section title="History" right={used ? <T v="caption">Tap a day to see it</T> : null}>
        {history && history.length === 0 ? (
          <Card><Empty icon="fish" title="No records yet" body="Sales, purchases and spoilage of this fish appear here." /></Card>
        ) : (
          <>
            <HistoryCalendar source={{ fishId: fish.id }} day={day} onDay={setDay} />
            <T v="label" style={{ marginTop: space.lg, marginBottom: 8 }}>{day ? short(day, true) : 'Latest records'}</T>
            {shown && shown.length === 0 ? (
              <Card><Empty icon="today" title="Nothing on this day" body="Pick a day with a dot." /></Card>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {shown?.map((m, i) => <Move key={`${m.kind}-${m.id}`} m={m} last={i === shown.length - 1} />)}
              </Card>
            )}
          </>
        )}
      </Section>
    </Screen>
  );
}

function Move({ m, last }: { m: FishMovement; last: boolean }) {
  const label = m.kind === 'sale' ? 'Sold' : m.kind === 'purchase' ? 'Bought' : 'Spoiled';
  const tone = m.kind === 'sale' ? 'green' : m.kind === 'purchase' ? 'neutral' : 'red';
  const table = m.kind === 'sale' ? 'sales' : m.kind === 'purchase' ? 'purchases' : 'spoilage';
  const open = () => openEntry(table, m.id);
  return (
    <Pressable onPress={open} onLongPress={open} style={({ pressed }) => [styles.row, !last && styles.line, pressed && { backgroundColor: color.sunk }]}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Tag label={label.toUpperCase()} tone={tone} />
          <T v="caption">{short(m.date, true)}</T>
        </View>
        <T v="body" style={{ marginTop: 4 }}>
          {kg(m.kg)}{m.price ? ` × ${peso(m.price)}` : ''}{m.person ? ` · ${m.person}` : ''}
        </T>
      </View>
      {m.total ? <T v="strong" style={{ fontVariant: ['tabular-nums'] }}>{peso(m.total)}</T> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineSoft },
});
