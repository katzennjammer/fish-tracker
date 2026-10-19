import {
  addExpense, addLoan, addPayment, addPurchase, addSale, addSpoilage, closeDay, listFish, savePerson, setOpeningCash,
  setSetting,
} from './db';
import { addDays, today } from './dates';

/**
 * Development only: fill an empty database with a believable two weeks of
 * stall records so every screen can be looked at. Never shipped to the UI.
 */
export async function seedDemo() {
  const t = today();
  const fish = await listFish();
  const id = (name: string) => fish.find((f) => f.name === name)!.id;
  await setSetting('owner_name', 'Nena');
  await setSetting('stall_name', 'Nena’s Isdaan');

  const nena = await savePerson({ name: 'Aling Cora', phone: '09171234567', kind: 'customer', note: 'Pays on Saturdays' });
  const berto = await savePerson({ name: 'Mang Berto', phone: '', kind: 'customer', note: '' });
  const liza = await savePerson({ name: 'Liza (karinderya)', phone: '', kind: 'customer', note: '' });
  const supplier = await savePerson({ name: 'Pantalan — Kuya Jun', phone: '', kind: 'supplier', note: '' });

  for (let i = 13; i >= 0; i--) {
    const d = addDays(t, -i);
    await setOpeningCash(d, 300000);
    await addPurchase({ date: d, fishId: id('Bangus'), kg: 12, price: 16000, paid: i % 3 ? 192000 : 120000, supplierId: supplier });
    await addPurchase({ date: d, fishId: id('Galunggong'), kg: 8, price: 14000, paid: 112000, supplierId: supplier });
    await addSale({ date: d, fishId: id('Bangus'), kg: 4.5 + (i % 4), price: 22000, paid: 1e9, customerId: null });
    await addSale({ date: d, fishId: id('Galunggong'), kg: 3 + (i % 3), price: 20000, paid: 1e9, customerId: null });
    await addSale({ date: d, fishId: id('Tilapia'), kg: 2 + (i % 2), price: 15000, paid: 1e9, customerId: null });
    await addExpense({ date: d, category: 'Ice', amount: 6000, note: '' });
    if (i % 2 === 0) await addExpense({ date: d, category: 'Transport', amount: 8000, note: 'Tricycle' });
    if (i % 7 === 0) await addExpense({ date: d, category: 'Stall rent', amount: 50000, note: '' });
    if (i > 0) await closeDay(d, null);
  }
  await addSale({ date: addDays(t, -20), fishId: id('Bangus'), kg: 3, price: 22000, paid: 0, customerId: berto });
  await addSale({ date: addDays(t, -9), fishId: id('Tulingan'), kg: 2, price: 24000, paid: 20000, customerId: nena });
  await addPayment({ date: addDays(t, -5), personId: nena, amount: 10000 });
  await addSale({ date: t, fishId: id('Bangus'), kg: 2.5, price: 22000, paid: 0, customerId: nena });
  await addSale({ date: t, fishId: id('Pusit'), kg: 1.5, price: 38000, paid: 30000, customerId: liza });
  await addPayment({ date: t, personId: berto, amount: 20000, note: 'GCash' });
  await addSpoilage({ date: t, fishId: id('Galunggong'), kg: 0.8, note: 'Walang yelo' });
  await addLoan({
    lender: 'GCash GLoan', principal: 1000000, total_payable: 1159800, installments: 6, frequency: 'monthly',
    first_due: addDays(t, 1), note: 'Freezer',
  });
  await addLoan({
    lender: 'Tala', principal: 300000, total_payable: 345000, installments: 3, frequency: 'biweekly',
    first_due: addDays(t, -14), note: '',
  });
}
