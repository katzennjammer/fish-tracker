import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, confirm, LedgerLine, PageHeader, Screen, Section, T } from '../../components/ui';
import { Icon } from '../../components/icons';
import { deleteLoan, getLoan, setDuePaid, type LoanDue } from '../../lib/db';
import { syncReminders } from '../../lib/notify';
import { useQuery } from '../../lib/useQuery';
import { peso } from '../../lib/format';
import { relativeDay, short, today } from '../../lib/dates';
import { color, font } from '../../lib/theme';

export default function LoanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const loanId = Number(id);
  const data = useQuery(() => getLoan(loanId), [loanId]);

  if (!data) return <Screen><PageHeader back title={data === null ? 'Not found' : ''} /></Screen>;
  const { loan, dues } = data;
  const left = loan.total_payable - loan.paid_amount;

  async function toggle(d: LoanDue) {
    if (d.paid_date) {
      if (!(await confirm('Mark as unpaid?', `Installment ${d.seq} — ${peso(d.amount)}`, 'Mark unpaid'))) return;
      await setDuePaid(d.id, null);
    } else {
      await setDuePaid(d.id, today());
    }
    syncReminders().catch(() => {});
  }

  async function remove() {
    if (!(await confirm(`Delete ${loan.lender} loan?`, 'Its schedule and reminders will be removed.'))) return;
    await deleteLoan(loan.id);
    syncReminders().catch(() => {});
    router.back();
  }

  return (
    <Screen footer={<Button label="Delete loan" kind="danger" small onPress={remove} />}>
      <PageHeader back eyebrow="Online loan" title={loan.lender} />
      <Card>
        <LedgerLine label="Amount received" value={peso(loan.principal)} />
        <LedgerLine label="Total to pay" value={peso(loan.total_payable)} />
        <LedgerLine label="Interest & fees" value={peso(Math.max(loan.total_payable - loan.principal, 0))} c={color.red} />
        <LedgerLine label="Paid so far" value={peso(loan.paid_amount)} c={color.green} />
        <LedgerLine bold label="Still to pay" value={peso(left)} />
        {loan.note ? <T v="caption" style={{ marginTop: 8 }}>{loan.note}</T> : null}
      </Card>

      <Section title="Payment schedule" right={<T v="caption">Tap to mark paid</T>}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {dues.map((d, i) => {
            const late = !d.paid_date && d.due_date < today();
            const rel = relativeDay(d.due_date);
            return (
              <Pressable
                key={d.id}
                onPress={() => toggle(d)}
                style={({ pressed }) => [styles.row, i < dues.length - 1 && styles.line, pressed && { backgroundColor: color.sunk }]}
              >
                <View style={[styles.box, d.paid_date ? styles.boxOn : late ? { borderColor: color.red } : null]}>
                  {d.paid_date ? <Icon name="check" size={16} color={color.seaText} strokeWidth={2.6} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <T v="strong" c={d.paid_date ? color.inkSoft : late ? color.red : color.ink}>
                    {short(d.due_date, true)}{rel ? ` · ${rel}` : ''}
                  </T>
                  <T v="caption">
                    {d.paid_date ? `Paid ${short(d.paid_date)}` : late ? 'Late — not yet paid' : `Payment ${d.seq} of ${dues.length}`}
                  </T>
                </View>
                <T
                  v="strong"
                  c={d.paid_date ? color.inkFaint : color.ink}
                  style={[{ fontFamily: font.semibold, fontVariant: ['tabular-nums'] }, d.paid_date ? { textDecorationLine: 'line-through' } : null]}
                >
                  {peso(d.amount)}
                </T>
              </Pressable>
            );
          })}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineSoft },
  box: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: color.inkFaint,
    alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: color.green, borderColor: color.green },
});
