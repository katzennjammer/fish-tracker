import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Empty, IconButton, Money, PageHeader, Screen, Section, T, Tag } from '../../components/ui';
import { listLoans, type LoanSummary } from '../../lib/db';
import { useQuery } from '../../lib/useQuery';
import { peso } from '../../lib/format';
import { daysBetween, relativeDay, short, today } from '../../lib/dates';
import { color, space } from '../../lib/theme';

export default function LoansScreen() {
  const loans = useQuery(() => listLoans(), []);
  const active = loans?.filter((l) => l.next_due) ?? [];
  const finished = loans?.filter((l) => !l.next_due) ?? [];
  const left = active.reduce((a, l) => a + (l.total_payable - l.paid_amount), 0);
  const dueSoon = active.filter((l) => l.next_due && daysBetween(today(), l.next_due) <= 7);
  const dueSoonTotal = dueSoon.reduce((a, l) => a + (l.next_amount ?? 0), 0);

  return (
    <Screen>
      <PageHeader
        back
        eyebrow="Online loans"
        title="Loans"
        right={<IconButton icon="plus" tone="sea" label="Add loan" onPress={() => router.push('/loans/new')} />}
      />
      <View style={styles.summary}>
        <T v="label" c={color.brass}>Still to pay</T>
        <Money cents={left} size={40} c={color.ink} style={{ marginTop: 4 }} />
        <T v="caption">
          {active.length} active {active.length === 1 ? 'loan' : 'loans'}
          {dueSoon.length ? ` · ${peso(dueSoonTotal)} due in the next 7 days` : ''}
        </T>
      </View>

      {loans && loans.length === 0 ? (
        <Card style={{ marginTop: space.lg }}>
          <Empty
            icon="loan"
            title="No loans recorded"
            body="Add each app loan with its due dates. You will get a reminder the day before each payment."
          />
        </Card>
      ) : null}

      {active.length ? (
        <Section title="Active">
          {active.map((l) => <LoanCard key={l.id} l={l} />)}
        </Section>
      ) : null}
      {finished.length ? (
        <Section title="Fully paid">
          {finished.map((l) => <LoanCard key={l.id} l={l} />)}
        </Section>
      ) : null}
    </Screen>
  );
}

function LoanCard({ l }: { l: LoanSummary }) {
  const share = l.total_payable ? l.paid_amount / l.total_payable : 0;
  const late = l.next_due ? l.next_due < today() : false;
  const rel = l.next_due ? relativeDay(l.next_due) : null;
  return (
    <Card onPress={() => router.push({ pathname: '/loans/[id]', params: { id: String(l.id) } })} style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <T v="heading">{l.lender}</T>
          <T v="caption">{l.paid_count} of {l.installments} paid · {peso(l.total_payable - l.paid_amount)} left</T>
        </View>
        {!l.next_due ? <Tag label="DONE" tone="green" /> : late ? <Tag label="LATE" tone="red" /> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${share * 100}%` }]} />
      </View>
      {l.next_due ? (
        <View style={styles.next}>
          <T v="caption">Next payment</T>
          <T v="strong" c={late ? color.red : color.ink}>
            {peso(l.next_amount ?? 0)} · {rel ?? short(l.next_due, true)}
          </T>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: color.brassTint, borderRadius: 18, padding: 18 },
  track: { height: 8, borderRadius: 4, backgroundColor: color.sunk, marginTop: 12, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: color.green, borderRadius: 4 },
  next: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.lineSoft,
  },
});
