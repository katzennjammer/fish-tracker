import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Segmented } from './ui';
import { Icon } from './icons';
import { periodLabel, periodRange, shiftPeriod, today, type Period } from '../lib/dates';
import { color, font, space } from '../lib/theme';

/** Day / Week / Month switch with ‹ period › navigation underneath. */
export function PeriodBar({
  period, anchor, onPeriod, onAnchor,
}: { period: Period; anchor: string; onPeriod: (p: Period) => void; onAnchor: (a: string) => void }) {
  const [, end] = periodRange(period, anchor);
  const atNow = end >= today();
  return (
    <View>
      <Segmented<Period>
        value={period}
        onChange={(p) => { onPeriod(p); onAnchor(today()); }}
        options={[{ value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }]}
      />
      <View style={styles.nav}>
        <Pressable onPress={() => onAnchor(shiftPeriod(period, anchor, -1))} hitSlop={10} style={styles.btn}>
          <Icon name="chevronLeft" size={20} />
        </Pressable>
        <Text style={styles.label}>{periodLabel(period, anchor)}</Text>
        <Pressable
          onPress={() => !atNow && onAnchor(shiftPeriod(period, anchor, 1))}
          hitSlop={10}
          style={[styles.btn, atNow && { opacity: 0.25 }]}
        >
          <Icon name="chevronRight" size={20} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  btn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.card,
  },
  label: { flex: 1, textAlign: 'center', fontFamily: font.display, fontSize: 20, color: color.ink },
});
