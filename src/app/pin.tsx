import { router } from 'expo-router';
import { PinPad } from '../components/PinPad';
import { toast } from '../components/ui';
import { setPin } from '../lib/pin';

export default function PinScreen() {
  return (
    <PinPad
      mode="create"
      onCancel={() => router.back()}
      onDone={async (pin) => {
        await setPin(pin);
        toast('PIN saved — the app will ask for it when opened');
        router.back();
      }}
    />
  );
}
