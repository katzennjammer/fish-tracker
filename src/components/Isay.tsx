import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { T } from './ui';
import { nudges, tipOfTheDay, type Nudge } from '../lib/tips';
import { useQuery } from '../lib/useQuery';
import { color, font } from '../lib/theme';

/** Isay, a small round fish who keeps the day's paalala. */
export function IsayFace({ size = 64, mood = 'happy' }: { size?: number; mood?: 'happy' | 'worried' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M45 32 L61 19 Q56.5 32 61 45 Z" fill="#E07A5F" />
      <Path d="M19 15 Q28 3 39 15 Z" fill="#E07A5F" />
      <Ellipse cx={28} cy={32} rx={22} ry={19} fill="#2C7C88" />
      <Path d="M10 38 Q28 54 46 38 Q40 50 28 50.5 Q15 50 10 38 Z" fill="#8FCBC3" />
      <G stroke="#57A3A9" strokeWidth={1.4} fill="none" strokeLinecap="round">
        <Path d="M33 22 q3 3 0 6" />
        <Path d="M39 25 q3 3 0 6" />
        <Path d="M36 31 q3 3 0 6" />
      </G>
      <Path d="M27 38 q7 7 13 1.5 q-5 -5.5 -13 -1.5 Z" fill="#1F6570" />
      <Circle cx={18} cy={27} r={7.2} fill="#FFFFFF" />
      <Circle cx={17} cy={28} r={3.8} fill="#12303B" />
      <Circle cx={15.6} cy={26.4} r={1.3} fill="#FFFFFF" />
      <Ellipse cx={24.5} cy={36.5} rx={3.2} ry={1.9} fill="#F2A08B" opacity={0.75} />
      {mood === 'happy' ? (
        <Path d="M9.5 36.5 q4 4.5 9 1" stroke="#12303B" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      ) : (
        <Path d="M10 39 q4 -3 8.5 0" stroke="#12303B" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      )}
    </Svg>
  );
}

export function PaalalaCard() {
  const extra = useQuery(() => nudges(), []);
  const messages: Nudge[] = [{ text: tipOfTheDay(), tone: 'tip' }, ...(extra ?? [])];
  const [i, setI] = useState(0);
  const current = messages[Math.min(i, messages.length - 1)];

  const [bob] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  const warn = current.tone === 'warn';

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ translateY }], marginTop: 8 }}>
        <IsayFace size={62} mood={warn ? 'worried' : 'happy'} />
      </Animated.View>
      <Pressable
        onPress={() => setI((n) => (n + 1) % messages.length)}
        style={[styles.bubble, warn && { borderColor: '#E9C3B6' }]}
        accessibilityHint="Tap for the next reminder"
      >
        <View style={[styles.tail, warn && { borderColor: '#E9C3B6' }]} />
        <View style={styles.head}>
          <T v="strong" c={color.sea} style={{ fontFamily: font.bold }}>Isay</T>
          <T v="caption" style={{ fontSize: 12 }}>
            {i === 0 ? 'Paalala ngayong araw' : warn ? 'Paalala' : 'Balita'}
          </T>
        </View>
        <T v="body" style={{ fontSize: 15.5, lineHeight: 22 }}>{current.text}</T>
        <View style={styles.foot}>
          {messages.length > 1 ? (
            <View style={styles.dots}>
              {messages.map((_, k) => (
                <View key={k} style={[styles.dot, k === i && { backgroundColor: color.sea, width: 14 }]} />
              ))}
            </View>
          ) : <View />}
          {current.link ? (
            <Pressable onPress={() => router.push(current.link as never)} hitSlop={8}>
              <T v="caption" c={color.sea} style={{ fontFamily: font.semibold }}>Tingnan →</T>
            </Pressable>
          ) : messages.length > 1 ? (
            <T v="caption" style={{ fontSize: 12 }}>Pindutin para sa susunod</T>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16 },
  bubble: {
    flex: 1,
    backgroundColor: color.card,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: 15,
    paddingTop: 11,
    paddingBottom: 11,
  },
  tail: {
    position: 'absolute',
    left: -7,
    top: 16,
    width: 12,
    height: 12,
    backgroundColor: color.card,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.line,
    transform: [{ rotate: '45deg' }],
  },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 3 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.line },
});
