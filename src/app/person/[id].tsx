import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, confirm, Empty, Money, openEntry, PageHeader, Screen, Section, T, Tag } from '../../components/ui';
import { Icon } from '../../components/icons';
import { addPayment, getPerson, getSetting, personLedger, type LedgerEntry, type PersonSummary } from '../../lib/db';
import { settle, type Settlement } from '../../lib/settle';
import { useQuery } from '../../lib/useQuery';
import { kg, peso } from '../../lib/format';
import { ago, daysBetween, short, today } from '../../lib/dates';
import { color, font, space } from '../../lib/theme';

export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const personId = Number(id);
  const person = useQuery(() => getPerson(personId), [personId]);
  const ledger = useQuery(() => personLedger(personId), [personId]);

  if (person === null) {
    return (
      <Screen>
        <PageHeader back title="Not found" />
      </Screen>
    );
  }
  if (!person || !ledger) return <Screen><View /></Screen>;

  const isCustomer = person.kind === 'customer';
  const tone = person.balance > 0 ? (isCustomer ? color.red : color.brass) : color.green;

  const rows = withRunningBalance(ledger);
  const settled = settle(ledger);

  const openSince = openSinceDate(ledger);
  const quiet = person.balance > 0 ? daysBetween(person.last_payment ?? openSince ?? today(), today()) : 0;

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            label={isCustomer ? 'New utang' : 'New purchase'}
            kind="ghost"
            icon="plus"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: isCustomer ? '/sale' : '/purchase', params: { personId: String(person.id) } })}
          />
          <Button
            label={isCustomer ? 'Got payment' : 'Pay them'}
            icon={isCustomer ? 'in' : 'out'}
            style={{ flex: 1.2 }}
            onPress={() => router.push({ pathname: '/payment', params: { personId: String(person.id), kind: person.kind } })}
          />
        </View>
      }
    >
      <PageHeader
        back
        eyebrow={isCustomer ? 'Customer' : 'Supplier'}
        title={person.name}
        right={
          <Pressable
            onPress={() => router.push({ pathname: '/person/edit', params: { id: String(person.id) } })}
            hitSlop={10}
            style={styles.edit}
          >
            <Icon name="edit" size={18} />
          </Pressable>
        }
      />

      <View style={[styles.balance, { borderColor: tone }]}>
        <T v="label" c={tone}>
          {person.balance > 0 ? (isCustomer ? 'Balance owed to you' : 'You still owe') : person.balance < 0 ? 'Overpaid' : 'All paid up'}
        </T>
        <Money cents={Math.abs(person.balance)} size={44} c={tone} style={{ marginTop: 6 }} />
        <View style={styles.facts}>
          <Fact label={isCustomer ? 'Utang since' : 'Credit since'} value={openSince ? short(openSince) : '—'} />
          <Fact label="Started paying" value={person.first_payment ? short(person.first_payment) : 'Not yet'} />
          <Fact label="Last payment" value={person.last_payment ? ago(person.last_payment) : '—'} />
        </View>
        {quiet >= 14 && isCustomer ? (
          <View style={styles.warn}>
            <Icon name="alert" size={16} color={color.red} />
            <T v="caption" c={color.red} style={{ flex: 1 }}>{quiet} days with no payment</T>
          </View>
        ) : null}
      </View>

      {person.balance > 0 ? (
        <Button
          small
          kind="secondary"
          icon="check"
          label={isCustomer ? `Paid in full · ${peso(person.balance)}` : `I paid in full · ${peso(person.balance)}`}
          onPress={() => payInFull(person)}
          style={{ marginTop: space.md }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <Button small kind="secondary" icon="share" label="Send balance" onPress={() => shareStatement(person, ledger)} style={{ flex: 1 }} />
        {person.phone ? (
          <Button small kind="secondary" icon="phone" label="Call" onPress={() => Linking.openURL(`tel:${person.phone}`)} style={{ flex: 1 }} />
        ) : null}
      </View>

      <View style={styles.totals}>
        <Total label={isCustomer ? 'Total taken on utang' : 'Total on credit'} value={peso(person.charged)} />
        <Total label="Total paid" value={peso(person.paid)} />
      </View>

      <Section title="History" right={rows.length ? <T v="caption">Tap to open</T> : null}>
        {rows.length === 0 ? (
          <Card><Empty icon="receipt" title="No entries yet" body="Utang and payments for this person will show here." /></Card>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {rows.map(({ e, after }, i) => (
              <Entry
                key={`${e.kind}-${e.id}`}
                e={e}
                after={after}
                last={i === rows.length - 1}
                isCustomer={isCustomer}
                settlement={settled.get(e.id)}
              />
            ))}
          </Card>
        )}
      </Section>
      {person.note ? (
        <Section title="Note"><Card><T v="body">{person.note}</T></Card></Section>
      ) : null}
    </Screen>
  );
}

/** Pair each entry with the balance after it, newest first for reading. */
function withRunningBalance(ledger: LedgerEntry[]) {
  const rows: { e: LedgerEntry; after: number }[] = [];
  let running = 0;
  for (const e of ledger) {
    running += e.kind === 'payment' ? -e.total : e.total - e.paid;
    rows.push({ e, after: running });
  }
  return rows.reverse();
}

/** The date the current unpaid stretch began — after the last time the balance hit zero. */
function openSinceDate(ledger: LedgerEntry[]): string | null {
  let bal = 0;
  let since: string | null = null;
  for (const e of ledger) {
    const delta = e.kind === 'payment' ? -e.total : e.total - e.paid;
    if (bal <= 0 && bal + delta > 0) since = e.date;
    bal += delta;
    if (bal <= 0) since = null;
  }
  return since;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <T v="caption" style={{ fontSize: 12.5 }} numberOfLines={1}>{label}</T>
      <T v="strong" style={{ marginTop: 1 }} numberOfLines={1}>{value}</T>
    </View>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <T v="caption">{label}</T>
      <T v="heading" style={{ fontVariant: ['tabular-nums'] }}>{value}</T>
    </View>
  );
}

async function payInFull(p: PersonSummary) {
  const msg = p.kind === 'customer'
    ? `${p.name} paid all ${peso(p.balance)} today. Their balance becomes zero.`
    : `You paid ${p.name} all ${peso(p.balance)} today. What you owe becomes zero.`;
  if (!(await confirm('Paid in full?', msg, 'Yes, paid'))) return;
  await addPayment({ date: today(), personId: p.id, amount: p.balance, note: 'Paid in full' });
}

/** Paid / partly paid / unpaid, worked out from the payments that followed. */
function StatusTag({ s, isCustomer }: { s: Settlement; isCustomer: boolean }) {
  if (s.owed <= 0) return <Tag label="PAID" tone="green" />;
  if (s.left === 0) return <Tag label={`PAID ✓ ${s.settledOn ? short(s.settledOn) : ''}`} tone="green" />;
  if (s.left < s.owed) return <Tag label={`${peso(s.left)} LEFT`} tone="brass" />;
  return <Tag label="UNPAID" tone={isCustomer ? 'red' : 'brass'} />;
}

function Entry({
  e, after, last, isCustomer, settlement,
}: { e: LedgerEntry; after: number; last: boolean; isCustomer: boolean; settlement?: Settlement }) {
  const isPay = e.kind === 'payment';
  const table = e.kind === 'sale' ? 'sales' : e.kind === 'purchase' ? 'purchases' : 'payments';
  const open = () => openEntry(table, e.id);

  return (
    <Pressable onPress={open} onLongPress={open} style={({ pressed }) => [styles.entry, !last && styles.entryLine, pressed && { backgroundColor: color.sunk }]}>
      <View style={[styles.dot, { backgroundColor: isPay ? color.green : isCustomer ? color.red : color.brass }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T v="strong" numberOfLines={1} style={{ flexShrink: 1 }}>{isPay ? 'Payment' : e.fish}</T>
          {!isPay && settlement ? <StatusTag s={settlement} isCustomer={isCustomer} /> : null}
        </View>
        <T v="caption" numberOfLines={2}>
          {short(e.date, true)}
          {!isPay && e.kg !== null && e.price !== null ? ` · ${kg(e.kg)} × ${peso(e.price)} = ${peso(e.total)}` : ''}
          {!isPay && e.paid > 0 ? ` · paid ${peso(e.paid)} then` : ''}
          {e.note ? ` · ${e.note}` : ''}
        </T>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <T v="strong" c={isPay ? color.green : color.ink} style={{ fontFamily: font.semibold, fontVariant: ['tabular-nums'] }}>
          {isPay ? `−${peso(e.total)}` : `+${peso(e.total - e.paid)}`}
        </T>
        <T v="caption" style={{ fontSize: 12, fontVariant: ['tabular-nums'] }}>bal {peso(after)}</T>
      </View>
    </Pressable>
  );
}

async function shareStatement(p: PersonSummary, ledger: LedgerEntry[]) {
  const stall = (await getSetting('stall_name')) || 'Analou Tracker';
  const lines = ledger.slice(-12).map((e) =>
    e.kind === 'payment'
      ? `${short(e.date)}  Paid  −${peso(e.total)}`
      : `${short(e.date)}  ${e.fish} ${kg(e.kg ?? 0)} × ${peso(e.price ?? 0)} = ${peso(e.total)}${e.paid ? ` (paid ${peso(e.paid)})` : ''}`,
  );
  const message = [
    `${stall}`,
    `Statement for ${p.name} — ${short(today())}`,
    '',
    ...lines,
    '',
    p.balance > 0 ? `Remaining balance: ${peso(p.balance)}` : 'Fully paid. Salamat!',
  ].join('\n');
  await Share.share({ message });
}

const styles = StyleSheet.create({
  edit: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.card, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line,
  },
  balance: {
    backgroundColor: color.card, borderRadius: 20, padding: 18, borderWidth: 1, borderLeftWidth: 5,
  },
  facts: {
    flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line,
  },
  warn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: color.redTint,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
  },
  totals: { flexDirection: 'row', gap: 10, marginTop: space.lg, paddingHorizontal: 4 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  entryLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineSoft },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
