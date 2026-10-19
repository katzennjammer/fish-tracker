import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { migrate, seedFishIfEmpty } from '../lib/db';
import { getPin } from '../lib/pin';
import { syncReminders } from '../lib/notify';
import { autoBackup } from '../lib/backup';
import { color } from '../lib/theme';
import { PinPad } from '../components/PinPad';
import { DialogHost } from '../components/DialogHost';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Lock again if the app sat in the background longer than this. */
const RELOCK_AFTER_MS = 3 * 60 * 1000;

async function init(db: Parameters<typeof migrate>[0]) {
  await migrate(db);
  await seedFishIfEmpty();
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });
  const [pin, setPinState] = useState<string | null | undefined>(undefined);
  const [locked, setLocked] = useState(true);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    getPin().then((p) => {
      setPinState(p);
      setLocked(!!p);
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active') {
        const p = await getPin();
        setPinState(p);
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        if (p && away > RELOCK_AFTER_MS) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const ready = fontsLoaded && pin !== undefined;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: color.paper }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SQLiteProvider databaseName="fish-ledger.db" onInit={init}>
        <Reminders />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: color.paper },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          {['entry', 'sale', 'purchase', 'payment', 'expense', 'capital', 'close-day', 'spoilage', 'person/edit', 'fish/edit', 'loans/new', 'pin'].map(
            (name) => (
              <Stack.Screen key={name} name={name} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            ),
          )}
        </Stack>
      </SQLiteProvider>
      {pin && locked ? <PinPad mode="unlock" expected={pin} onDone={() => setLocked(false)} /> : null}
      <DialogHost />
    </SafeAreaProvider>
  );
}

/** Once the database is ready: re-plan reminders and take the day's backup. */
function Reminders() {
  useEffect(() => {
    syncReminders().catch((e) => console.warn('reminders', e));
    autoBackup().catch((e) => console.warn('backup', e));
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') autoBackup().catch((e) => console.warn('backup', e));
    });
    if (__DEV__ && Platform.OS === 'web') {
      // Lets the browser preview load sample data from the console.
      import('../lib/demo').then((m) => {
        (globalThis as { seedDemo?: () => Promise<void> }).seedDemo = m.seedDemo;
      });
    }
    return () => sub.remove();
  }, []);
  return null;
}
