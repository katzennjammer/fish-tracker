import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Button, Field, Screen, SheetHeader, T, done } from '../../components/ui';
import { getFish, saveFish } from '../../lib/db';
import { centsToInput, parseAmount, peso, toCents } from '../../lib/format';
import { color } from '../../lib/theme';

export default function FishEditScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : undefined;
  const [name, setName] = useState('');
  const [sell, setSell] = useState('');
  const [buy, setBuy] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!id) return;
    getFish(id).then((f) => {
      if (!f) return;
      setName(f.name);
      setSell(centsToInput(f.sell_price));
      setBuy(centsToInput(f.buy_price));
    });
  }, [id]);

  const sellC = toCents(parseAmount(sell) ?? 0);
  const buyC = toCents(parseAmount(buy) ?? 0);

  async function save() {
    setTried(true);
    if (!name.trim()) return;
    await saveFish({ id, name: name.trim(), sell_price: sellC, buy_price: buyC });
    done('Fish saved');
  }

  return (
    <Screen footer={<Button label={id ? 'Save' : 'Add fish'} onPress={save} />}>
      <SheetHeader title={id ? 'Edit fish' : 'New fish'} subtitle="Prices are per kilo. You can still change them on each sale." />
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Bangus"
        autoCapitalize="words"
        autoFocus={!id}
        error={tried && !name.trim() ? 'Enter a name' : undefined}
      />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Field label="Buy cost / kg" value={buy} onChangeText={setBuy} keyboardType="decimal-pad" placeholder="0" prefix="₱" big style={{ flex: 1 }} />
        <Field label="Sell price / kg" value={sell} onChangeText={setSell} keyboardType="decimal-pad" placeholder="0" prefix="₱" big style={{ flex: 1 }} />
      </View>
      {sellC && buyC ? (
        <T v="strong" c={sellC >= buyC ? color.green : color.red}>
          {sellC >= buyC ? `You gain ${peso(sellC - buyC)} per kilo` : `You lose ${peso(buyC - sellC)} per kilo`}
        </T>
      ) : null}
    </Screen>
  );
}
