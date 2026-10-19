import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { color, font } from '../lib/theme';
import { Icon } from './icons';

const LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

type Props =
  | { mode: 'unlock'; expected: string; onDone: () => void; title?: string }
  | { mode: 'create'; onDone: (pin: string) => void; onCancel?: () => void; title?: string };

/** Full-screen four-digit keypad, used to unlock and to set a new PIN. */
export function PinPad(props: Props) {
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState('');

  const title =
    props.title ??
    (props.mode === 'unlock' ? 'Enter your PIN' : first ? 'Type it once more' : 'Choose a 4-digit PIN');

  function buzz() {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }

  function complete(value: string) {
    if (props.mode === 'unlock') {
      if (value === props.expected) props.onDone();
      else {
        buzz();
        setError('Wrong PIN. Try again.');
        setEntry('');
      }
      return;
    }
    if (!first) {
      setFirst(value);
      setEntry('');
      setError('');
    } else if (first === value) {
      props.onDone(value);
    } else {
      buzz();
      setFirst(null);
      setEntry('');
      setError('Those did not match. Start again.');
    }
  }

  function press(key: string) {
    if (key === 'del') {
      setEntry((e) => e.slice(0, -1));
      return;
    }
    if (!key || entry.length >= LENGTH) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const next = entry + key;
    setEntry(next);
    if (next.length === LENGTH) setTimeout(() => complete(next), 120);
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 30 }]}>
      <View style={{ alignItems: 'center' }}>
        <View style={styles.badge}>
          <Icon name="lock" size={26} color={color.seaText} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.error}>{error || ' '}</Text>
        <View style={styles.dots}>
          {Array.from({ length: LENGTH }, (_, i) => (
            <View key={i} style={[styles.dot, i < entry.length && styles.dotOn]} />
          ))}
        </View>
      </View>
      <View style={styles.keys}>
        {KEYS.map((k, i) => (
          <Pressable
            key={i}
            onPress={() => press(k)}
            disabled={!k}
            style={({ pressed }) => [styles.key, !k && { opacity: 0 }, pressed && { backgroundColor: color.seaSoft }]}
          >
            {k === 'del' ? (
              <Icon name="chevronLeft" size={26} color={color.seaText} />
            ) : (
              <Text style={styles.keyText}>{k}</Text>
            )}
          </Pressable>
        ))}
      </View>
      {props.mode === 'create' && props.onCancel ? (
        <Pressable onPress={props.onCancel} style={{ alignSelf: 'center', padding: 10 }}>
          <Text style={[styles.error, { color: color.seaMuted }]}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: color.sea, justifyContent: 'space-between', zIndex: 100 },
  badge: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 1, borderColor: color.seaSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 22,
  },
  title: { fontFamily: font.display, fontSize: 26, color: color.seaText },
  error: { fontFamily: font.medium, fontSize: 14, color: '#F0A58F', marginTop: 8 },
  dots: { flexDirection: 'row', gap: 18, marginTop: 18 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: color.seaMuted },
  dotOn: { backgroundColor: color.seaText, borderColor: color.seaText },
  keys: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 40, rowGap: 14 },
  key: {
    width: '33.33%', height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 35,
  },
  keyText: { fontFamily: font.display, fontSize: 30, color: color.seaText },
});
