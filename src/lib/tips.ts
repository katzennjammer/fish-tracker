import { addDays, daysBetween, relativeDay, today } from './dates';
import { peso } from './format';
import { daySummary, getDay, listPeople, upcomingDues } from './db';

/** The Siamese cat who delivers the paalala. */
export const MASCOT_NAME = 'Yuki';

// Daily paalala in Tagalog. One saying per day (the same all day, a new one
// tomorrow), plus reminders built from her own records.

export const TIPS = [
  'Huwag magpautang sa hindi marunong magbayad.',
  'Ilista agad ang bawat benta, kahit maliit. Ang hindi nailista, madaling makalimutan.',
  'Ang puhunan ay pambili ng paninda, hindi pambili ng gusto.',
  'Bilangin ang pera bago umuwi. Ang hindi nabibilang, nawawala.',
  'Unahing ibenta ang isdang mas naunang nabili.',
  'Bago magpautang ulit, tingnan muna kung magkano pa ang dati niyang utang.',
  'Ihiwalay ang pera ng tindahan sa pera ng bahay.',
  'Huwag mangutang para lang ipambayad sa ibang utang.',
  'Ang bawat gastos ay bawas sa tubo. Ilista rin ang yelo, plastik, at pamasahe.',
  'Magtabi kahit kaunti araw-araw para sa mga araw na matumal.',
  'Maningil nang mahinahon. Ang suki ay mas madaling kausapin kaysa kaaway.',
  'Alamin kung aling isda ang pinakamabenta, iyon ang dagdagan.',
  'Huwag bumili ng sobra kung hindi kayang ubusin bago masira.',
  'Bawat utang na hindi nasingil ay perang hindi na bumabalik sa puhunan.',
  'Bayaran sa tamang araw ang online loan para walang patong na multa.',
  'Huwag umutang sa app para sa luho. Para lang iyan sa negosyo o sa tunay na pangangailangan.',
  'Kumain at magpahinga. Ikaw ang pinakamahalagang puhunan ng tindahan.',
  'Mag-ipon na ng pambayad sa loan bago pa dumating ang due date.',
  'Huwag magpadala sa awa kung alam mong hindi siya magbabayad.',
  'Ang benta ay hindi pa tubo. Ibawas muna ang puhunan at ang mga gastos.',
  'Magtiwala, pero ilista.',
  'Huwag ipagpaliban ang paniningil. Habang tumatagal, lalong humihirap.',
  'Kapag nagbago ang presyo ng bili, baguhin din ang presyo ng benta.',
  'Unahin ang bayarin bago ang gusto.',
  'Pag may tiyaga, may nilaga.',
  'Ang malinis at maayos na puwesto, binabalik-balikan ng suki.',
  'Kapag may nagbayad ng utang, ilista agad para walang pagtatalo.',
  'Mas magaan ang maliliit na hulog kaysa isang malaking singil. Hikayatin ang unti-unting bayad.',
  'Kung may natirang isda, isipin kung paano pa ito mapapakinabangan bukas.',
  'Kapag kulang ang pera sa kahon, hanapin agad habang sariwa pa sa isip.',
  'Ang sipag sa umaga ay benta sa tanghali.',
  'Alagaan ang suking marunong magbayad. Sila ang tunay na yaman ng tindahan.',
  'Iwasan ang utang na mataas ang interes. Basahin muna kung magkano talaga ang babayaran.',
  'Huwag magbigay ng bagong utang hangga’t hindi pa nababawasan ang luma.',
  'Tingnan ang listahan ng utang kahit isang beses sa isang linggo.',
  'Ang kaunting tubo araw-araw ay mas mabuti kaysa malaking lugi minsan.',
  'Kilalanin ang presyo sa palengke. Silipin ang presyo ng ibang tindera.',
  'Ang ngiti ay libre, pero nakakabenta.',
  'Huwag ipautang ang perang pambili ng paninda bukas.',
  'Ang hindi marunong maningil, mauubusan ng puhunan.',
] as const;

/** Same tip all day; tomorrow brings the next. A fixed stride keeps neighbours apart. */
export function tipOfTheDay(date = today()): string {
  const day = daysBetween('2024-01-01', date);
  const n = TIPS.length;
  const i = (((day * 7) % n) + n) % n;
  return TIPS[i];
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export type Nudge = { text: string; tone: 'tip' | 'warn' | 'good'; link?: string };

/** Reminders drawn from her own records, most urgent first. */
export async function nudges(): Promise<Nudge[]> {
  const out: Nudge[] = [];
  const t = today();

  const dues = await upcomingDues(1);
  for (const d of dues.slice(0, 2)) {
    const rel = relativeDay(d.due_date);
    if (d.due_date < t) {
      out.push({ text: `Lampas na sa due date ang bayad mo sa ${d.lender} (${peso(d.amount)}). Bayaran agad para hindi lumaki ang multa.`, tone: 'warn', link: '/loans' });
    } else if (rel === 'Today') {
      out.push({ text: `Ngayon ang bayad mo sa ${d.lender}: ${peso(d.amount)}. Huwag kalimutan!`, tone: 'warn', link: '/loans' });
    } else {
      out.push({ text: `Bukas na ang bayad mo sa ${d.lender}: ${peso(d.amount)}. Ihanda na ngayon pa lang.`, tone: 'warn', link: '/loans' });
    }
  }

  const people = await listPeople('customer');
  const quiet = people
    .filter((p) => p.balance > 0)
    .map((p) => ({ p, days: daysBetween(p.last_payment ?? p.first_credit ?? t, t) }))
    .filter((x) => x.days >= 14)
    .sort((a, b) => b.days - a.days);
  if (quiet.length) {
    const { p, days } = quiet[0];
    out.push({
      text: `Si ${p.name} ay ${days} araw nang hindi nagbabayad. ${peso(p.balance)} pa ang utang. Paalalahanan nang mahinahon.`,
      tone: 'warn',
      link: `/person/${p.id}`,
    });
  }

  const day = await getDay(t);
  if (!day) out.push({ text: 'Hindi mo pa nailalagay ang puhunan mo ngayong araw. Ilagay na para tama ang bilang mamaya.', tone: 'tip', link: '/capital' });

  const yesterday = await daySummary(addDays(t, -1));
  if (yesterday.closed && yesterday.counted !== null) {
    const diff = yesterday.counted - yesterday.expected;
    if (diff < 0) out.push({ text: `Kulang ng ${peso(-diff)} ang bilang kahapon. Baka may gastos o bili na hindi nailista.`, tone: 'warn' });
    else if (diff === 0) out.push({ text: 'Sakto ang bilang ng pera kahapon. Ang galing!', tone: 'good' });
  }

  return out;
}

