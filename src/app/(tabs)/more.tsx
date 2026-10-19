import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Card, PageHeader, Screen, T } from '../../components/ui';
import { Icon, type IconName } from '../../components/icons';
import { listLoans, report } from '../../lib/db';
import { useQuery } from '../../lib/useQuery';
import { peso } from '../../lib/format';
import { periodRange, relativeDay, short, today } from '../../lib/dates';
import { color, space } from '../../lib/theme';

export default function MoreScreen() {
  const loans = useQuery(() => listLoans(), []);
  const [ms, me] = periodRange('month', today());
  const month = useQuery(() => report(ms, me), [ms, me]);

  const left = loans?.reduce((a, l) => a + (l.total_payable - l.paid_amount), 0) ?? 0;
  const next = loans?.find((l) => l.next_due);
  const nextText = next?.next_due
    ? `Next: ${next.lender} ${relativeDay(next.next_due)?.toLowerCase() ?? short(next.next_due)}`
    : 'No payments due';

  return (
    <Screen>
      <PageHeader eyebrow="Everything else" title="More" />
      <Tile
        icon="loan"
        tone={color.brass}
        title="Online loans"
        value={left ? peso(left) : '—'}
        sub={loans?.length ? `${loans.filter((l) => l.next_due).length} active · ${nextText}` : 'GLoan, SLoan, Tala, Home Credit…'}
        onPress={() => router.push('/loans')}
      />
      <Tile
        icon="chart"
        tone={color.green}
        title="Profit & reports"
        value={month ? peso(month.net) : '—'}
        sub="Net profit this month"
        onPress={() => router.push('/reports')}
      />
      <Tile
        icon="settings"
        tone={color.sea}
        title="Settings & backup"
        sub="Stall name, PIN lock, save a backup"
        onPress={() => router.push('/settings')}
      />
    </Screen>
  );
}

function Tile({
  icon, tone, title, value, sub, onPress,
}: { icon: IconName; tone: string; title: string; value?: string; sub: string; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={{ marginBottom: space.md }}>
      <View style={styles.tile}>
        <View style={[styles.icon, { backgroundColor: tone }]}>
          <Icon name={icon} size={22} color={color.seaText} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="heading">{title}</T>
          <T v="caption" numberOfLines={1}>{sub}</T>
        </View>
        {value ? <T v="title" style={{ fontSize: 20 }}>{value}</T> : null}
        <Icon name="chevronRight" size={18} color={color.inkFaint} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
