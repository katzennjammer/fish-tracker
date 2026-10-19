import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Button } from './ui';
import { Icon } from './icons';
import { attachDialogHost, type DialogRequest } from '../lib/dialog';
import { color, font } from '../lib/theme';

const YUKI = require('../../assets/mascot/still.png');

/** Draws confirm/notice dialogs and toasts requested through lib/dialog. */
export function DialogHost() {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const [toastText, setToastText] = useState<string | null>(null);
  const [fade] = useState(() => new Animated.Value(0));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      attachDialogHost({
        dialog: (req) => {
          if (Platform.OS !== 'web' && req.kind === 'confirm' && req.tone === 'danger') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          }
          setQueue((q) => [...q, req]);
        },
        toast: (message) => {
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setToastText(message);
          if (hideTimer.current) clearTimeout(hideTimer.current);
          Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
          hideTimer.current = setTimeout(() => {
            Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToastText(null));
          }, 2200);
        },
      }),
    [fade],
  );

  const current = queue[0];
  function close(ok: boolean) {
    current?.resolve(ok);
    setQueue((q) => q.slice(1));
  }

  return (
    <>
      <Modal
        visible={!!current}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => close(false)}
      >
        <Pressable style={styles.scrim} onPress={() => current?.kind === 'notice' && close(true)}>
          {current ? (
            <Pressable style={styles.card} onPress={() => {}}>
              <View style={styles.head}>
                {current.kind === 'confirm' && current.tone === 'danger' ? (
                  <View style={[styles.badge, { backgroundColor: color.redTint }]}>
                    <Icon name="trash" size={22} color={color.red} />
                  </View>
                ) : current.kind === 'notice' && current.tone === 'error' ? (
                  <View style={[styles.badge, { backgroundColor: color.brassTint }]}>
                    <Icon name="alert" size={22} color={color.brass} />
                  </View>
                ) : (
                  <View style={[styles.badge, { backgroundColor: '#F4E9D8', overflow: 'hidden' }]}>
                    <Image source={YUKI} style={{ width: 52, height: 52 }} contentFit="cover" />
                  </View>
                )}
              </View>
              <Text style={styles.title}>{current.title}</Text>
              {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
              <View style={styles.actions}>
                {current.kind === 'confirm' ? (
                  <>
                    <Button label="Cancel" kind="ghost" onPress={() => close(false)} style={{ flex: 1 }} />
                    <Button
                      label={current.confirmLabel}
                      kind={current.tone === 'danger' ? 'dangerFill' : 'primary'}
                      onPress={() => close(true)}
                      style={{ flex: 1.2 }}
                    />
                  </>
                ) : (
                  <Button label="OK" onPress={() => close(true)} style={{ flex: 1 }} />
                )}
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

      {toastText ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            { bottom: insets.bottom + 96, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
          ]}
        >
          <View style={styles.toastCheck}>
            <Icon name="check" size={14} color={color.sea} strokeWidth={3} />
          </View>
          <Text style={styles.toastText} numberOfLines={2}>{toastText}</Text>
        </Animated.View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(20, 52, 63, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: color.card,
    borderRadius: 24,
    padding: 22,
    paddingTop: 20,
  },
  head: { alignItems: 'flex-start', marginBottom: 14 },
  badge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.display, fontSize: 23, lineHeight: 29, color: color.ink, letterSpacing: -0.3 },
  message: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: color.inkSoft, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '86%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: color.sea,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 18,
    borderRadius: 16,
    zIndex: 200,
  },
  toastCheck: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: color.seaText, alignItems: 'center', justifyContent: 'center',
  },
  toastText: { fontFamily: font.semibold, fontSize: 15, color: color.seaText, flexShrink: 1 },
});
