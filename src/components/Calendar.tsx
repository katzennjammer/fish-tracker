import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './icons';
import { useQuery } from '../lib/useQuery';
import { activeDays } from '../lib/db';
import { addMonths, iso, parse, today } from '../lib/dates';
import { color, font } from '../lib/theme';

// A month grid used two ways: as a pop-up for picking a date on forms, and
// inline on history screens, where dots show the days that have records.

const WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export type DayMark = 'in' | 'out' | 'both';
/** Whose records the dots come from. */
export type MarkSource = { personId?: number; fishId?: number; all?: boolean };

export function monthStart(date: string) {
  return date.slice(0, 8) + '01';
}

function monthEnd(start: string) {
  const d = parse(start);
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function monthTitle(start: string) {
  const d = parse(start);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function useMarks(start: string, source?: MarkSource) {
  return useQuery(
    () => (source ? activeDays(start, monthEnd(start), source.personId, source.fishId) : Promise.resolve(new Map<string, DayMark>())),
    [start, source?.personId, source?.fishId, source?.all],
  );
}

function MonthGrid({
  start, selected, marks, onSelect, max,
}: { start: string; selected: string | null; marks?: Map<string, DayMark>; onSelect: (d: string) => void; max?: string }) {
  const first = parse(start);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => iso(new Date(first.getFullYear(), first.getMonth(), i + 1))),
  ];
  while (cells.length % 7) cells.push(null);
  const now = today();

  return (
    <View>
      <View style={styles.week}>
        {WEEK.map((w) => <Text key={w} style={styles.weekText}>{w}</Text>)}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const on = d === selected;
          const disabled = !!max && d > max;
          const mark = marks?.get(d);
          return (
            <Pressable key={d} disabled={disabled} onPress={() => onSelect(d)} style={styles.cell} hitSlop={2}>
              <View style={[styles.day, d === now && !on && styles.today, on && styles.dayOn]}>
                <Text style={[styles.dayText, on && { color: color.seaText }, disabled && { color: color.line }]}>
                  {Number(d.slice(8))}
                </Text>
              </View>
              <View style={styles.dots}>
                {mark === 'out' || mark === 'both' ? <View style={[styles.dot, { backgroundColor: color.red }]} /> : null}
                {mark === 'in' || mark === 'both' ? <View style={[styles.dot, { backgroundColor: color.green }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MonthNav({ start, onChange, max }: { start: string; onChange: (s: string) => void; max?: string }) {
  const canNext = !max || addMonths(start, 1) <= monthStart(max);
  return (
    <View style={styles.nav}>
      <Pressable onPress={() => onChange(addMonths(start, -1))} hitSlop={10} style={styles.navBtn}>
        <Icon name="chevronLeft" size={20} />
      </Pressable>
      <Pressable onPress={() => onChange(monthStart(today()))} style={{ flex: 1 }}>
        <Text style={styles.navTitle}>{monthTitle(start)}</Text>
      </Pressable>
      <Pressable onPress={() => canNext && onChange(addMonths(start, 1))} hitSlop={10} style={[styles.navBtn, !canNext && { opacity: 0.25 }]}>
        <Icon name="chevronRight" size={20} />
      </Pressable>
    </View>
  );
}

/** Pop-up date picker. Dots appear when `marks` says whose records to show. */
export function CalendarSheet({
  visible, value, onPick, onClose, max = today(), marks,
}: { visible: boolean; value: string; onPick: (d: string) => void; onClose: () => void; max?: string; marks?: MarkSource }) {
  const [start, setStart] = useState(monthStart(value));
  const dots = useMarks(start, marks);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={() => setStart(monthStart(value))}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <MonthNav start={start} onChange={setStart} max={max} />
          <MonthGrid start={start} selected={value} marks={dots} max={max} onSelect={(d) => { onPick(d); onClose(); }} />
          <View style={styles.sheetFoot}>
            <Pressable onPress={() => { onPick(today()); onClose(); }} style={styles.footBtn}>
              <Text style={styles.footText}>Today</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.footBtn}>
              <Text style={[styles.footText, { color: color.inkSoft }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Inline calendar for history screens. `day` null means "show everything";
 * tapping a day filters to it, tapping it again shows everything again.
 */
export function HistoryCalendar({
  source, day, onDay,
}: { source: MarkSource; day: string | null; onDay: (d: string | null) => void }) {
  const [start, setStart] = useState(monthStart(day ?? today()));
  const dots = useMarks(start, source);
  return (
    <View style={styles.inline}>
      <MonthNav start={start} onChange={setStart} />
      <MonthGrid start={start} selected={day} marks={dots} onSelect={(d) => onDay(d === day ? null : d)} />
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: color.red }]} />
          <Text style={styles.legendText}>{source.personId ? 'Utang' : source.fishId ? 'Bought / spoiled' : 'Money out'}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: color.green }]} />
          <Text style={styles.legendText}>{source.fishId ? 'Sold' : source.personId ? 'Paid' : 'Money in'}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {day ? (
          <Pressable onPress={() => onDay(null)} hitSlop={8}>
            <Text style={styles.showAll}>Show all</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(20, 52, 63, 0.45)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: color.card, borderRadius: 24, padding: 16, maxWidth: 420, width: '100%', alignSelf: 'center' },
  inline: {
    backgroundColor: color.card, borderRadius: 18, padding: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: color.line,
  },
  nav: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.sunk },
  navTitle: { textAlign: 'center', fontFamily: font.display, fontSize: 19, color: color.ink },
  week: { flexDirection: 'row' },
  weekText: { flex: 1, textAlign: 'center', fontFamily: font.semibold, fontSize: 12, color: color.inkFaint, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 3 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1.5, borderColor: color.sea },
  dayOn: { backgroundColor: color.sea },
  dayText: { fontFamily: font.medium, fontSize: 15.5, color: color.ink },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  sheetFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  footBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  footText: { fontFamily: font.semibold, fontSize: 15.5, color: color.sea },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 6, paddingTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontFamily: font.body, fontSize: 12.5, color: color.inkSoft },
  showAll: { fontFamily: font.semibold, fontSize: 14, color: color.sea },
});
