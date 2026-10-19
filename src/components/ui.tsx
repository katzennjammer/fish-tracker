import { useState, type ReactNode } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { color, font, radius, space } from '../lib/theme';
import { money } from '../lib/format';
import { addDays, relativeDay, short, today } from '../lib/dates';
import type { EntryTable } from '../lib/db';
import { Icon, type IconName } from './icons';

/* ───────────── text ───────────── */

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'strong';

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: font.display, fontSize: 34, lineHeight: 40, color: color.ink, letterSpacing: -0.6 },
  title: { fontFamily: font.display, fontSize: 24, lineHeight: 30, color: color.ink, letterSpacing: -0.3 },
  heading: { fontFamily: font.semibold, fontSize: 17, lineHeight: 23, color: color.ink },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 22, color: color.ink },
  strong: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22, color: color.ink },
  label: {
    fontFamily: font.semibold, fontSize: 11.5, lineHeight: 15, color: color.inkSoft,
    letterSpacing: 1.1, textTransform: 'uppercase',
  },
  caption: { fontFamily: font.body, fontSize: 13.5, lineHeight: 18, color: color.inkSoft },
};

export function T({
  v = 'body', style, children, numberOfLines, c,
}: { v?: Variant; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number; c?: string }) {
  return (
    <Text style={[variants[v], c ? { color: c } : null, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/** A peso amount with a small raised ₱, set in the display face. */
export function Money({
  cents, size = 28, c = color.ink, sign = false, style,
}: { cents: number; size?: number; c?: string; sign?: boolean; style?: StyleProp<ViewStyle> }) {
  const neg = cents < 0;
  const prefix = neg ? '−' : sign && cents > 0 ? '+' : '';
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-start' }, style]}>
      <Text style={{ fontFamily: font.display, fontSize: size * 0.55, lineHeight: size * 0.8, color: c, marginTop: size * 0.12, marginRight: 1 }}>
        {prefix}₱
      </Text>
      <Text style={{ fontFamily: font.display, fontSize: size, lineHeight: size * 1.15, color: c, letterSpacing: -size * 0.02 }}>
        {money(Math.abs(cents))}
      </Text>
    </View>
  );
}

/* ───────────── layout ───────────── */

export function Screen({
  children, scroll = true, padded = true, footer,
}: { children: ReactNode; scroll?: boolean; padded?: boolean; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const pad = padded ? { paddingHorizontal: 20 } : null;
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[pad, { paddingTop: insets.top + 12, paddingBottom: footer ? 24 : 120 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingTop: insets.top + 12 }, pad]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: color.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>{footer}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function PageHeader({
  eyebrow, title, right, back,
}: { eyebrow?: string; title: string; right?: ReactNode; back?: boolean }) {
  return (
    <View style={{ marginBottom: space.xl }}>
      {back ? (
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Icon name="chevronLeft" size={20} color={color.inkSoft} />
          <T v="caption" style={{ fontFamily: font.medium }}>Back</T>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <T v="label" style={{ marginBottom: 4 }}>{eyebrow}</T> : null}
          <T v="display">{title}</T>
        </View>
        {right}
      </View>
    </View>
  );
}

/** Header for modal forms: a close button and a title. */
export function SheetHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: space.xl }}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close}>
        <Icon name="close" size={20} color={color.ink} />
      </Pressable>
      <T v="title" style={{ fontSize: 28, lineHeight: 34 }}>{title}</T>
      {subtitle ? <T v="caption" style={{ marginTop: 4 }}>{subtitle}</T> : null}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Section({ title, right, children, style }: { title: string; right?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: space.xl }, style]}>
      <View style={styles.sectionHead}>
        <T v="label">{title}</T>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: color.line }, style]} />;
}

/** "Label ........ value", the way a notebook ledger is ruled. */
export function LedgerLine({
  label, value, c, bold, dim,
}: { label: string; value: ReactNode; c?: string; bold?: boolean; dim?: boolean }) {
  const labelColor = dim ? color.seaMuted : c ?? color.inkSoft;
  return (
    <View style={styles.ledger}>
      <Text style={[styles.ledgerLabel, { color: labelColor }, bold && { fontFamily: font.semibold }]}>{label}</Text>
      <Text style={[styles.dots, { color: dim ? color.seaSoft : color.line }]} numberOfLines={1} ellipsizeMode="clip">
        {' . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .'}
      </Text>
      {typeof value === 'string' ? (
        <Text style={[styles.ledgerValue, { color: c ?? (dim ? color.seaText : color.ink) }, bold && { fontFamily: font.bold }]}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/* ───────────── controls ───────────── */

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'light';

export function Button({
  label, onPress, kind = 'primary', icon, disabled, style, small,
}: {
  label: string; onPress: () => void; kind?: ButtonKind; icon?: IconName; disabled?: boolean;
  style?: StyleProp<ViewStyle>; small?: boolean;
}) {
  const palette: Record<ButtonKind, { bg: string; fg: string; border: string }> = {
    primary: { bg: color.sea, fg: color.seaText, border: color.sea },
    secondary: { bg: 'transparent', fg: color.ink, border: color.ink },
    danger: { bg: 'transparent', fg: color.red, border: color.red },
    ghost: { bg: color.sunk, fg: color.ink, border: color.sunk },
    light: { bg: color.card, fg: color.sea, border: color.card },
  };
  const p = palette[kind];
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: p.bg, borderColor: p.border },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 18 : 20} color={p.fg} strokeWidth={2} /> : null}
      <Text style={[styles.buttonText, small && { fontSize: 14.5 }, { color: p.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, tone = 'plain' }: { icon: IconName; onPress: () => void; label?: string; tone?: 'plain' | 'sea' }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, tone === 'sea' && { backgroundColor: color.sea, borderColor: color.sea }, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={tone === 'sea' ? color.seaText : color.ink} strokeWidth={2} />
    </Pressable>
  );
}

export function Field({
  label, prefix, suffix, hint, error, big, style, ...input
}: TextInputProps & { label: string; prefix?: string; suffix?: string; hint?: string; error?: string; big?: boolean; style?: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: space.xl }, style]}>
      <T v="label" style={{ marginBottom: 6 }}>{label}</T>
      <View style={[styles.field, focused && { borderColor: color.sea }, error ? { borderColor: color.red } : null]}>
        {prefix ? <Text style={[styles.affix, big && { fontSize: 26 }]}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor={color.inkFaint}
          selectionColor={color.sea}
          cursorColor={color.sea}
          {...input}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          style={[styles.input, big && styles.inputBig, input.multiline && { minHeight: 60, textAlignVertical: 'top' }]}
        />
        {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
      </View>
      {error ? <T v="caption" c={color.red} style={{ marginTop: 6 }}>{error}</T> : hint ? <T v="caption" style={{ marginTop: 6 }}>{hint}</T> : null}
    </View>
  );
}

export function Segmented<V extends string>({
  options, value, onChange, style,
}: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.segment, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segmentItem, on && styles.segmentOn]}>
            <Text style={[styles.segmentText, on && { color: color.ink, fontFamily: font.semibold }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label, sub, on, onPress, tone = 'sea',
}: { label: string; sub?: string; on?: boolean; onPress: () => void; tone?: 'sea' | 'red' }) {
  const bg = tone === 'red' ? color.red : color.sea;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, on && { backgroundColor: bg, borderColor: bg }, pressed && !on && styles.pressed]}
    >
      <Text style={[styles.chipText, on && { color: color.seaText }]} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={[styles.chipSub, on && { color: color.seaMuted }]} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
  );
}

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'green' | 'red' | 'brass' }) {
  const map = {
    neutral: [color.sunk, color.inkSoft],
    green: [color.greenTint, color.green],
    red: [color.redTint, color.red],
    brass: [color.brassTint, color.brass],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Row({
  title, sub, right, onPress, onLongPress, leading, last,
}: {
  title: string; sub?: string; right?: ReactNode; onPress?: () => void; onLongPress?: () => void;
  leading?: ReactNode; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && { backgroundColor: color.sunk }]}
    >
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="strong" numberOfLines={1}>{title}</T>
        {sub ? <T v="caption" numberOfLines={1} style={{ marginTop: 1 }}>{sub}</T> : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={color.inkSoft} />
      </View>
      <T v="heading" style={{ textAlign: 'center' }}>{title}</T>
      <T v="caption" style={{ textAlign: 'center', marginTop: 4, maxWidth: 260 }}>{body}</T>
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

/** ‹  Today, Oct 19  › — dates move a day at a time; tapping the label returns to today. */
export function DateStepper({ value, onChange, max = today() }: { value: string; onChange: (d: string) => void; max?: string }) {
  const rel = relativeDay(value);
  const atMax = value >= max;
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(addDays(value, -1))} hitSlop={10} style={styles.stepBtn}>
        <Icon name="chevronLeft" size={20} />
      </Pressable>
      <Pressable onPress={() => onChange(today())} style={{ flex: 1, alignItems: 'center' }}>
        <Text style={styles.stepText}>{rel ? `${rel} · ${short(value)}` : short(value, true)}</Text>
      </Pressable>
      <Pressable onPress={() => !atMax && onChange(addDays(value, 1))} hitSlop={10} style={[styles.stepBtn, atMax && { opacity: 0.25 }]}>
        <Icon name="chevronRight" size={20} />
      </Pressable>
    </View>
  );
}

export function confirm(title: string, message: string, destructiveLabel = 'Delete'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: destructiveLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function notice(title: string, message: string) {
  if (Platform.OS === 'web') globalThis.alert?.(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

/** Open a record's sheet, where it can be marked as paid or deleted. */
export function openEntry(table: EntryTable, id: number) {
  router.push({ pathname: '/entry', params: { table, id: String(id) } });
}

export function done() {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  router.back();
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: color.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 14, marginLeft: -4, alignSelf: 'flex-start' },
  close: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: color.sunk, marginBottom: 18,
  },
  card: {
    backgroundColor: color.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    padding: space.lg,
  },
  pressed: { backgroundColor: color.sunk },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  ledger: { flexDirection: 'row', alignItems: 'flex-end', paddingVertical: 5 },
  ledgerLabel: { fontFamily: font.body, fontSize: 15, color: color.inkSoft },
  ledgerValue: { fontFamily: font.medium, fontSize: 15, color: color.ink, fontVariant: ['tabular-nums'] },
  dots: { flex: 1, fontFamily: font.body, fontSize: 13, marginHorizontal: 6, overflow: 'hidden', letterSpacing: 1 },
  button: {
    minHeight: 54, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingHorizontal: 18,
  },
  buttonSmall: { minHeight: 42, borderRadius: 12, paddingHorizontal: 14 },
  buttonText: { fontFamily: font.semibold, fontSize: 16.5, letterSpacing: 0.1 },
  iconButton: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: color.line, backgroundColor: color.card,
  },
  field: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderColor: color.ink, gap: 6 },
  input: {
    flex: 1, fontFamily: font.medium, fontSize: 20, color: color.ink, paddingVertical: 8,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  inputBig: { fontFamily: font.display, fontSize: 34, paddingVertical: 4 },
  affix: { fontFamily: font.display, fontSize: 20, color: color.inkSoft },
  segment: { flexDirection: 'row', backgroundColor: color.sunk, borderRadius: 12, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  segmentOn: {
    backgroundColor: color.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  segmentText: { fontFamily: font.medium, fontSize: 14.5, color: color.inkSoft },
  chip: {
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: color.line,
    backgroundColor: color.card, minWidth: 92,
  },
  chipText: { fontFamily: font.semibold, fontSize: 15.5, color: color.ink },
  chipSub: { fontFamily: font.body, fontSize: 12.5, color: color.inkSoft, marginTop: 1 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  tagText: { fontFamily: font.semibold, fontSize: 11.5, letterSpacing: 0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: space.lg },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineSoft },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 20 },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: color.sunk, alignItems: 'center',
    justifyContent: 'center', marginBottom: 12,
  },
  stepper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: color.card, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: color.line, paddingHorizontal: 6, height: 46,
  },
  stepBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: font.semibold, fontSize: 15, color: color.ink },
});
