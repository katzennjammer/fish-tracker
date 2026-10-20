import { useRef, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Button, notice, Screen, SheetHeader } from '../components/ui';
import { getPerson, getSetting, personLedger, type LedgerEntry, type PersonSummary } from '../lib/db';
import { entryKey, settle } from '../lib/settle';
import { useQuery } from '../lib/useQuery';
import { kg, peso } from '../lib/format';
import { short, today } from '../lib/dates';
import { color, font } from '../lib/theme';

const YUKI = require('../../assets/icon.png');
const CORAL = '#E07A5F';
const ROWS = 8;

/** A colourful statement card, shared as a picture (or as text). */
export default function StatementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const personId = Number(id);
  const data = useQuery(async () => {
    const [person, ledger, stall] = await Promise.all([getPerson(personId), personLedger(personId), getSetting('stall_name')]);
    return { person, ledger, stall: stall || 'Analou Tracker' };
  }, [personId]);
  const card = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  if (!data?.person) return <Screen><SheetHeader title="Send balance" /></Screen>;
  const { person, ledger, stall } = data;

  async function sharePicture() {
    if (Platform.OS === 'web') return shareText();
    setBusy(true);
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `Balance for ${person!.name}` });
    } catch (e) {
      notice('Could not make the picture', e instanceof Error ? e.message : 'Try sending it as text.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function shareText() {
    await Share.share({ message: statementText(person!, ledger, stall) });
  }

  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          <Button label="Send as picture" icon="share" onPress={sharePicture} disabled={busy} />
          <Button label="Send as text" kind="ghost" small onPress={shareText} />
        </View>
      }
    >
      <SheetHeader title="Send balance" subtitle="This picture can be sent by Messenger, Viber or SMS." />
      <View ref={card} collapsable={false} style={styles.card}>
        <StatementCard person={person} ledger={ledger} stall={stall} />
      </View>
    </Screen>
  );
}

function StatementCard({ person, ledger, stall }: { person: PersonSummary; ledger: LedgerEntry[]; stall: string }) {
  const isCustomer = person.kind === 'customer';
  const settled = settle(ledger);
  const recent = ledger.slice(-ROWS).reverse();
  const owes = person.balance > 0;

  return (
    <>
      <View style={styles.top}>
        <Image source={YUKI} style={styles.yuki} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.stall} numberOfLines={1}>{stall}</Text>
          <Text style={styles.sub}>Statement · {short(today(), true)}</Text>
        </View>
      </View>
      <View style={styles.wave}>
        {Array.from({ length: 14 }, (_, i) => <View key={i} style={styles.scallop} />)}
      </View>

      <View style={styles.body}>
        <Text style={styles.for}>{isCustomer ? 'For' : 'From'}</Text>
        <Text style={styles.name} numberOfLines={1}>{person.name}</Text>

        <View style={[styles.balance, { backgroundColor: owes ? CORAL : color.green }]}>
          <Text style={styles.balanceLabel}>{owes ? (isCustomer ? 'Remaining balance' : 'Amount we still owe') : 'Fully paid'}</Text>
          <Text style={styles.balanceValue}>{owes ? peso(person.balance) : '✓ ' + peso(0)}</Text>
        </View>

        <View style={styles.totals}>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>{isCustomer ? 'Total utang' : 'Total credit'}</Text>
            <Text style={styles.totalValue}>{peso(person.charged)}</Text>
          </View>
          <View style={[styles.totalBox, { backgroundColor: '#DCEAE2' }]}>
            <Text style={styles.totalLabel}>Total paid</Text>
            <Text style={[styles.totalValue, { color: color.green }]}>{peso(person.paid)}</Text>
          </View>
        </View>

        <Text style={styles.recentTitle}>{ledger.length > ROWS ? `Last ${ROWS} entries` : 'Entries'}</Text>
        {recent.map((e) => {
          const pay = e.kind === 'payment';
          const s = settled.get(entryKey(e.kind, e.id));
          const what =
            pay ? 'Payment' : e.kind === 'balance' ? (e.balance_kind === 'old' ? 'Old balance' : 'Utang') : `${e.fish} ${kg(e.kg ?? 0)} × ${peso(e.price ?? 0)}`;
          return (
            <View key={`${e.kind}-${e.id}`} style={styles.row}>
              <View style={[styles.rowDot, { backgroundColor: pay ? color.green : CORAL }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowWhat} numberOfLines={1}>{what}</Text>
                <Text style={styles.rowDate}>
                  {short(e.date, true)}
                  {!pay && s && s.owed > 0 ? (s.left === 0 ? '  ·  PAID ✓' : s.left < s.owed ? `  ·  ${peso(s.left)} left` : '') : ''}
                </Text>
              </View>
              <Text style={[styles.rowAmount, { color: pay ? color.green : color.ink }]}>
                {pay ? '−' : '+'}{peso(pay ? e.total : e.total - e.paid)}
              </Text>
            </View>
          );
        })}

        <View style={styles.thanks}>
          <Text style={styles.thanksText}>{owes && isCustomer ? 'Salamat po sa pagbili! Pakibayaran po kapag kaya na. 🐟' : 'Salamat po! 🐟'}</Text>
        </View>
      </View>
    </>
  );
}

function statementText(p: PersonSummary, ledger: LedgerEntry[], stall: string) {
  const lines = ledger.slice(-12).map((e) =>
    e.kind === 'payment'
      ? `${short(e.date)}  Paid  −${peso(e.total)}`
      : e.kind === 'balance'
        ? `${short(e.date)}  ${e.balance_kind === 'old' ? 'Old balance' : 'Utang'}  ${peso(e.total)}`
        : `${short(e.date)}  ${e.fish} ${kg(e.kg ?? 0)} × ${peso(e.price ?? 0)} = ${peso(e.total)}${e.paid ? ` (paid ${peso(e.paid)})` : ''}`,
  );
  return [
    stall,
    `Statement for ${p.name} — ${short(today())}`,
    '',
    ...lines,
    '',
    p.balance > 0 ? `Remaining balance: ${peso(p.balance)}` : 'Fully paid. Salamat!',
  ].join('\n');
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FBF6EC', borderRadius: 26, overflow: 'hidden', alignSelf: 'center', width: '100%', maxWidth: 380 },
  top: { backgroundColor: color.sea, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, paddingBottom: 22 },
  yuki: { width: 62, height: 62, borderRadius: 18, borderWidth: 2, borderColor: '#F5EAD2' },
  stall: { fontFamily: font.displayBold, fontSize: 23, color: '#F5EAD2' },
  sub: { fontFamily: font.medium, fontSize: 13, color: color.seaMuted, marginTop: 2 },
  wave: { flexDirection: 'row', backgroundColor: '#FBF6EC', marginTop: -10, height: 10, overflow: 'visible' },
  scallop: { flex: 1, height: 20, marginTop: -10, borderRadius: 10, backgroundColor: color.sea },
  body: { padding: 20, paddingTop: 16 },
  for: { fontFamily: font.semibold, fontSize: 12, letterSpacing: 1.2, color: color.inkFaint, textTransform: 'uppercase' },
  name: { fontFamily: font.displayBold, fontSize: 30, color: color.ink, marginTop: 2 },
  balance: { borderRadius: 18, padding: 16, marginTop: 14 },
  balanceLabel: { fontFamily: font.semibold, fontSize: 13, color: '#FFF4EE', letterSpacing: 0.4 },
  balanceValue: { fontFamily: font.displayBold, fontSize: 38, color: '#FFFFFF', marginTop: 2 },
  totals: { flexDirection: 'row', gap: 10, marginTop: 10 },
  totalBox: { flex: 1, backgroundColor: '#F7E1D8', borderRadius: 14, padding: 12 },
  totalLabel: { fontFamily: font.medium, fontSize: 12.5, color: color.inkSoft },
  totalValue: { fontFamily: font.display, fontSize: 19, color: CORAL, marginTop: 2 },
  recentTitle: { fontFamily: font.semibold, fontSize: 12, letterSpacing: 1.2, color: color.inkFaint, textTransform: 'uppercase', marginTop: 18, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#EFE6D6', borderStyle: 'dashed' },
  rowDot: { width: 9, height: 9, borderRadius: 5 },
  rowWhat: { fontFamily: font.semibold, fontSize: 14.5, color: color.ink },
  rowDate: { fontFamily: font.body, fontSize: 12.5, color: color.inkSoft, marginTop: 1 },
  rowAmount: { fontFamily: font.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
  thanks: { marginTop: 16, backgroundColor: '#F1E6CC', borderRadius: 14, padding: 12, alignItems: 'center' },
  thanksText: { fontFamily: font.semibold, fontSize: 14, color: color.brass, textAlign: 'center' },
});
