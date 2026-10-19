import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { T } from './ui';
import { MASCOT_NAME, nudges, tipOfTheDay, type Nudge } from '../lib/tips';
import { useQuery } from '../lib/useQuery';
import { color, font } from '../lib/theme';

// The mascot is a Siamese cat in a fish-vendor apron. Each mood is a short
// animated WebP cut from the Flow videos; idle loops, the others play once
// and hand back to idle.
type Mood = 'idle' | 'happy' | 'worried';

const CLIPS: Record<Mood, number> = {
  idle: require('../../assets/mascot/idle.webp'),
  happy: require('../../assets/mascot/happy.webp'),
  worried: require('../../assets/mascot/worried.webp'),
};
/** How long a reaction shows before she settles back to idle. */
const REACTION_MS: Record<Exclude<Mood, 'idle'>, number> = { happy: 4000, worried: 4000 };
/** Matches the background of the clips so the tile edge disappears. */
const CLIP_BG = '#F4E9D8';

/** The clips carry margin for her wave, so zoom in a little and let the tile trim it. */
const ZOOM = 1.18;

export function MascotFace({ size = 82, mood }: { size?: number; mood: Mood }) {
  const inner = size * ZOOM;
  const offset = (size - inner) / 2;
  return (
    <View style={[styles.face, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Image
        source={CLIPS[mood]}
        style={{ width: inner, height: inner, marginLeft: offset, marginTop: offset }}
        contentFit="cover"
        autoplay
      />
    </View>
  );
}

/** Plays a reaction for each new message, then returns to the idle loop. */
function useMood(tone: Nudge['tone'], index: number): [Mood, string] {
  const reaction: Mood = tone === 'warn' ? 'worried' : tone === 'good' || index === 0 ? 'happy' : 'idle';
  const message = `${index}-${tone}`;
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => {
    if (reaction === 'idle') return;
    const t = setTimeout(() => setSettled(message), REACTION_MS[reaction]);
    return () => clearTimeout(t);
  }, [message, reaction]);
  const mood = settled === message ? 'idle' : reaction;
  // A new key restarts the clip from its first frame.
  return [mood, `${message}-${mood}`];
}

export function PaalalaCard() {
  const extra = useQuery(() => nudges(), []);
  const messages: Nudge[] = [{ text: tipOfTheDay(), tone: 'tip' }, ...(extra ?? [])];
  const [i, setI] = useState(0);
  const current = messages[Math.min(i, messages.length - 1)];

  const warn = current.tone === 'warn';
  const [mood, clipKey] = useMood(current.tone, i);

  return (
    <View style={styles.wrap}>
      <MascotFace key={clipKey} mood={mood} />
      <Pressable
        onPress={() => setI((n) => (n + 1) % messages.length)}
        style={[styles.bubble, warn && { borderColor: '#E9C3B6' }]}
        accessibilityHint="Tap for the next reminder"
      >
        <View style={[styles.tail, warn && { borderColor: '#E9C3B6' }]} />
        <View style={styles.head}>
          <T v="strong" c={color.sea} style={{ fontFamily: font.bold }}>{MASCOT_NAME}</T>
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
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 16 },
  face: { overflow: 'hidden', backgroundColor: CLIP_BG },
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
    top: 26,
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
