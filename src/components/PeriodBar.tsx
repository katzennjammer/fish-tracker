import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Segmented } from './ui';
import { Icon } from './icons';
import { CalendarSheet } from './Calendar';
import { periodLabel, periodRange, shiftPeriod, today, type Period } from '../lib/dates';
import { color, font, space } from '../lib/theme';

/** Day / Week / Month switch with ‹ period › navigation underneath. */
export function PeriodBar({
  period, anchor, onPeriod, onAnchor,
}: { period: Period; anchor: string; onPeriod: (p: Period) => void; onAnchor: (a: string) => void }) {
  const [, end] = periodRange(period, anchor);
  const atNow = end >= today();
  const [open, setOpen] = useState(false);
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
        <Pressable onPress={() => setOpen(true)} style={styles.labelBtn}>
          <Icon name="today" size={17} color={color.sea} />
          <Text style={styles.label}>{periodLabel(period, anchor)}</Text>
        </Pressable>
        <Pressable
          onPress={() => !atNow && onAnchor(shiftPeriod(period, anchor, 1))}
          hitSlop={10}
          style={[styles.btn, atNow && { opacity: 0.25 }]}
        >
          <Icon name="chevronRight" size={20} />
        </Pressable>
      </View>
      <CalendarSheet visible={open} value={anchor} marks={{ all: true }} onPick={onAnchor} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', marginTop: space.md },
  btn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, backgroundColor: color.card,
  },
  labelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { textAlign: 'center', fontFamily: font.display, fontSize: 20, color: color.ink },
});
