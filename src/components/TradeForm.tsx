import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, DateStepper, Field, notice, Screen, Segmented, SheetHeader, T, done } from './ui';
import { FishPicker, PersonPicker } from './pickers';
import { addPurchase, addSale, type FishWithStock } from '../lib/db';
import { centsToInput, kg as fmtKg, parseAmount, peso, toCents } from '../lib/format';
import { today } from '../lib/dates';
import { color, space } from '../lib/theme';

type Mode = 'full' | 'partial' | 'credit';

/** One form for both selling to customers and buying stock from suppliers. */
export function TradeForm({ kind }: { kind: 'sale' | 'purchase' }) {
  const params = useLocalSearchParams<{ date?: string; personId?: string; fishId?: string }>();
  const isSale = kind === 'sale';
  const [date, setDate] = useState(params.date ?? today());
  const [fish, setFish] = useState<FishWithStock | null>(null);
  const [kgText, setKgText] = useState('');
  const [priceText, setPriceText] = useState('');
  const [mode, setMode] = useState<Mode>(params.personId ? 'credit' : 'full');
  const [paidText, setPaidText] = useState('');
  const [personId, setPersonId] = useState<number | null>(params.personId ? Number(params.personId) : null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  const kgValue = parseAmount(kgText);
  const price = parseAmount(priceText);
  const total = kgValue && price ? Math.round(kgValue * toCents(price)) : 0;
  const paidNow = mode === 'full' ? total : mode === 'credit' ? 0 : Math.min(toCents(parseAmount(paidText) ?? 0), total);
  const left = total - paidNow;
  const needsPerson = mode !== 'full';

  function pickFish(f: FishWithStock) {
    setFish(f);
    const p = isSale ? f.sell_price : f.buy_price;
    setPriceText(centsToInput(p));
  }

  const problems = {
    fish: !fish ? 'Pick a fish' : '',
    kg: !kgValue ? 'Enter the kilos' : '',
    price: !price ? 'Enter the price per kilo' : '',
    paid: mode === 'partial' && (!paidNow || paidNow >= total) ? 'Enter an amount less than the total' : '',
    person: needsPerson && !personId ? `Choose who ${isSale ? 'owes this' : 'you owe'}` : '',
  };
  const valid = Object.values(problems).every((p) => !p);

  async function save(again: boolean) {
    setTried(true);
    if (!valid || !fish || !kgValue || !price) return;
    setBusy(true);
    try {
      const entry = { date, fishId: fish.id, kg: kgValue, price: toCents(price), paid: paidNow, note: note.trim() };
      if (isSale) await addSale({ ...entry, customerId: personId });
      else await addPurchase({ ...entry, supplierId: personId });
      if (again) {
        setKgText('');
        setPaidText('');
        setNote('');
        setTried(false);
        if (!params.personId) {
          setMode('full');
          setPersonId(null);
        }
        notice('Saved', `${fish.name} ${fmtKg(kgValue)} — ${peso(total)}`);
      } else {
        done();
      }
    } finally {
      setBusy(false);
    }
  }

  const err = (k: keyof typeof problems) => (tried ? problems[k] || undefined : undefined);

  return (
    <Screen
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Save + next" kind="ghost" onPress={() => save(true)} disabled={busy} style={{ flex: 1 }} />
          <Button label={isSale ? 'Save sale' : 'Save stock'} onPress={() => save(false)} disabled={busy} style={{ flex: 1.4 }} />
        </View>
      }
    >
      <SheetHeader
        title={isSale ? 'Sell fish' : 'Buy stock'}
        subtitle={isSale ? 'Record what a customer took.' : 'Record fish you bought to sell.'}
      />
      <DateStepper value={date} onChange={setDate} />

      <View style={{ marginTop: space.xl }}>
        <T v="label" style={{ marginBottom: 10 }}>Which fish</T>
        <FishPicker value={fish?.id ?? null} onChange={pickFish} priceOf={isSale ? 'sell_price' : 'buy_price'} />
        {err('fish') ? <T v="caption" c={color.red} style={{ marginTop: 6 }}>{err('fish')}</T> : null}
      </View>

      <View style={styles.pair}>
        <Field
          label="Kilos"
          value={kgText}
          onChangeText={setKgText}
          keyboardType="decimal-pad"
          placeholder="0"
          suffix="kg"
          big
          error={err('kg')}
          style={{ flex: 1 }}
        />
        <Field
          label={isSale ? 'Price per kg' : 'Cost per kg'}
          value={priceText}
          onChangeText={setPriceText}
          keyboardType="decimal-pad"
          placeholder="0"
          prefix="₱"
          big
          error={err('price')}
          style={{ flex: 1 }}
        />
      </View>
      {isSale && fish && fish.bought > 0 && kgValue && kgValue > fish.stock ? (
        <T v="caption" c={color.brass} style={{ marginTop: -14, marginBottom: 14 }}>
          Only {fmtKg(Math.max(fish.stock, 0))} of {fish.name} left in stock.
        </T>
      ) : null}

      <View style={styles.total}>
        <View>
          <T v="label" c={color.seaMuted}>Total</T>
          <T v="caption" c={color.seaMuted}>
            {kgValue && price ? `${fmtKg(kgValue)} × ${peso(toCents(price))}` : 'kilos × price'}
          </T>
        </View>
        <T v="display" c={color.seaText} style={{ fontSize: 36 }}>{peso(total)}</T>
      </View>

      <T v="label" style={{ marginTop: space.xl, marginBottom: 10 }}>{isSale ? 'How did they pay?' : 'How did you pay?'}</T>
      <Segmented<Mode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'full', label: 'Paid full' },
          { value: 'partial', label: 'Partial' },
          { value: 'credit', label: isSale ? 'Utang' : 'Credit' },
        ]}
      />

      {mode === 'partial' ? (
        <Field
          label="Paid now"
          value={paidText}
          onChangeText={setPaidText}
          keyboardType="decimal-pad"
          placeholder="0"
          prefix="₱"
          style={{ marginTop: space.xl, marginBottom: 0 }}
          error={err('paid')}
          hint={total && paidNow ? `${peso(left)} goes to ${isSale ? 'their utang' : 'what you owe'}` : undefined}
        />
      ) : null}
      {mode === 'credit' && total ? (
        <T v="caption" c={isSale ? color.red : color.brass} style={{ marginTop: 10 }}>
          The full {peso(total)} will be added to {isSale ? 'their utang' : 'what you owe this supplier'}.
        </T>
      ) : null}

      <T v="label" style={{ marginTop: space.xl, marginBottom: 10 }}>
        {isSale ? 'Customer' : 'Supplier'} {needsPerson ? '' : '(optional)'}
      </T>
      <PersonPicker kind={isSale ? 'customer' : 'supplier'} value={personId} onChange={setPersonId} required={tried && needsPerson} />
      {err('person') ? <T v="caption" c={color.red} style={{ marginTop: 6 }}>{err('person')}</T> : null}

      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. for the fiesta" style={{ marginTop: space.xl }} />

      <T v="caption" style={{ textAlign: 'center' }} c={color.inkFaint}>
        Wrong entry? Hold it on the Today screen to delete.
      </T>
      <View style={{ height: 10 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: 16, marginTop: space.xl },
  total: {
    backgroundColor: color.sea, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
});
