import { useRef, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Button, notice, Screen, Segmented, SheetHeader } from '../components/ui';
import { getPerson, getSetting, personLedger, type LedgerEntry, type PersonSummary } from '../lib/db';
import { CARD_ROWS, dayEntries, dayTotals, statementDay, statementText, type Scope } from '../lib/statement';
import { entryKey, settle } from '../lib/settle';
import { useQuery } from '../lib/useQuery';
import { kg, peso } from '../lib/format';
import { short, today } from '../lib/dates';
import { color, font } from '../lib/theme';

const YUKI = require('../../assets/icon.png');
const CORAL = '#E07A5F';

/** A colourful statement card, shared as a picture (or as text). */
export default function StatementScreen() {
  const params = useLocalSearchParams<{ id: string; day?: string }>();
  const personId = Number(params.id);
  const [picked, setScope] = useState<Scope>('day');
  const data = useQuery(async () => {
    const [person, ledger, stall] = await Promise.all([getPerson(personId), personLedger(personId), getSetting('stall_name')]);
    return { person, ledger, stall: stall || 'Analou Tracker' };
  }, [personId]);
  const card = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  if (!data?.person) return <Screen><SheetHeader title={params.day ? 'Send this day' : 'Send balance'} /></Screen>;
  const { person, ledger, stall } = data;
  // A day with nothing on it has nothing to send, so the statement falls back to the whole account.
  const day = statementDay(params.day, ledger);
  const scope: Scope = day ? picked : 'all';

  async function sharePicture() {
    if (Platform.OS === 'web') return shareText();
    setBusy(true);
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      const title = `${scope !== 'all' && day ? short(day) : 'Balance'} for ${person!.name}`;
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title });
    } catch (e) {
      notice('Could not make the picture', e instanceof Error ? e.message : 'Try sending it as text.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function shareText() {
    try {
      await Share.share({ message: statementText(person!, ledger, stall, scope, day) });
    } catch (e) {
      notice('Could not send the text', e instanceof Error ? e.message : 'Please try again.', 'error');
    }
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
      <SheetHeader title={day ? 'Send this day' : 'Send balance'} subtitle="This picture can be sent by Messenger, Viber or SMS." />
      {day ? (
        <Segmented<Scope>
          value={scope}
          onChange={setScope}
          options={[
            { value: 'day', label: 'This day' },
            { value: 'dayBalance', label: '+ Balance' },
            { value: 'all', label: 'All records' },
          ]}
          style={{ marginBottom: 14 }}
        />
      ) : null}
      <View ref={card} collapsable={false} style={styles.card}>
        <StatementCard person={person} ledger={ledger} stall={stall} scope={scope} day={day} />
      </View>
    </Screen>
  );
}

function StatementCard({
  person, ledger, stall, scope, day,
}: { person: PersonSummary; ledger: LedgerEntry[]; stall: string; scope: Scope; day: string | null }) {
  const isCustomer = person.kind === 'customer';
  const settled = settle(ledger);
  const oneDay = scope !== 'all' && day !== null;
  const shown = (oneDay ? dayEntries(ledger, day) : ledger.slice(-CARD_ROWS)).reverse();
  const { taken, paid } = dayTotals(oneDay ? shown : []);
  const owes = person.balance > 0;
  const showBalance = !oneDay || scope === 'dayBalance';
  const dayLabel = day ? short(day, true) : '';
  // With no balance box the day's own figure leads: what was taken, or the payment if that is all there was.
  const leadPaid = taken === 0;

  return (
    <>
      <View style={styles.top}>
        <Image source={YUKI} style={styles.yuki} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <Text style={styles.stall} numberOfLines={1}>{stall}</Text>
          <Text style={styles.sub}>Statement · {short(oneDay ? day : today(), true)}</Text>
        </View>
      </View>
      <View style={styles.wave}>
        {Array.from({ length: 14 }, (_, i) => <View key={i} style={styles.scallop} />)}
      </View>

      <View style={styles.body}>
        <Text style={styles.for}>{isCustomer ? 'For' : 'From'}</Text>
        <Text style={styles.name} numberOfLines={1}>{person.name}</Text>

        {showBalance ? (
          <View style={[styles.balance, { backgroundColor: owes ? CORAL : color.green }]}>
            <Text style={styles.balanceLabel}>{owes ? (isCustomer ? 'Remaining balance' : 'Amount we still owe') : 'Fully paid'}</Text>
            <Text style={styles.balanceValue}>{owes ? peso(person.balance) : '✓ ' + peso(0)}</Text>
          </View>
        ) : (
          <View style={[styles.balance, { backgroundColor: leadPaid ? color.green : CORAL }]}>
            <Text style={styles.balanceLabel}>{leadPaid ? `Paid on ${dayLabel}` : `Total for ${dayLabel}`}</Text>
            <Text style={styles.balanceValue}>{peso(leadPaid ? paid : taken)}</Text>
          </View>
        )}

        {oneDay ? (
          <DayBoxes
            dayLabel={dayLabel}
            // Whichever figure already fills the big box above is not repeated underneath.
            taken={showBalance && taken > 0 ? taken : null}
            paid={paid > 0 && (showBalance || !leadPaid) ? paid : null}
          />
        ) : (
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
        )}

        <Text style={styles.recentTitle}>
          {oneDay ? `Entries on ${dayLabel}` : ledger.length > CARD_ROWS ? `Last ${CARD_ROWS} entries` : 'Entries'}
        </Text>
        {shown.map((e) => {
          const pay = e.kind === 'payment';
          const s = settled.get(entryKey(e.kind, e.id));
          const what =
            pay ? 'Payment' : e.kind === 'balance' ? (e.balance_kind === 'old' ? 'Old balance' : 'Utang') : `${e.fish} ${kg(e.kg ?? 0)} × ${peso(e.price ?? 0)}`;
          // A day's rows show the full value so they add up to the day's total; money paid with the goods is noted beside it.
          const amount = pay ? e.total : oneDay ? e.total : e.total - e.paid;
          return (
            <View key={`${e.kind}-${e.id}`} style={styles.row}>
              <View style={[styles.rowDot, { backgroundColor: pay ? color.green : CORAL }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowWhat} numberOfLines={1}>{what}</Text>
                <Text style={styles.rowDate}>
                  {short(e.date, true)}
                  {oneDay && !pay && e.paid > 0 ? `  ·  paid ${peso(e.paid)}` : ''}
                  {!pay && s && s.owed > 0 ? (s.left === 0 ? '  ·  PAID ✓' : s.left < s.owed ? `  ·  ${peso(s.left)} left` : '') : ''}
                </Text>
              </View>
              <Text style={[styles.rowAmount, { color: pay ? color.green : color.ink }]}>
                {pay ? '−' : '+'}{peso(amount)}
              </Text>
            </View>
          );
        })}

        <View style={styles.thanks}>
          <Text style={styles.thanksText}>{showBalance && owes && isCustomer ? 'Salamat po sa pagbili! Pakibayaran po kapag kaya na. 🐟' : 'Salamat po! 🐟'}</Text>
        </View>
      </View>
    </>
  );
}

function DayBoxes({ dayLabel, taken, paid }: { dayLabel: string; taken: number | null; paid: number | null }) {
  if (taken === null && paid === null) return null;
  return (
    <View style={styles.totals}>
      {taken !== null ? (
        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Total for {dayLabel}</Text>
          <Text style={styles.totalValue}>{peso(taken)}</Text>
        </View>
      ) : null}
      {paid !== null ? (
        <View style={[styles.totalBox, { backgroundColor: '#DCEAE2' }]}>
          <Text style={styles.totalLabel}>Paid on {dayLabel}</Text>
          <Text style={[styles.totalValue, { color: color.green }]}>{peso(paid)}</Text>
        </View>
      ) : null}
    </View>
  );
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
