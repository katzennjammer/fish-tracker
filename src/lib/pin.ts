import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'fish-ledger-pin';
const web = Platform.OS === 'web';

export async function getPin(): Promise<string | null> {
  if (web) return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

export async function setPin(pin: string | null) {
  if (web) {
    if (pin) globalThis.localStorage?.setItem(KEY, pin);
    else globalThis.localStorage?.removeItem(KEY);
    return;
  }
  if (pin) await SecureStore.setItemAsync(KEY, pin);
  else await SecureStore.deleteItemAsync(KEY);
}
