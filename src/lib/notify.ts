import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { addDays, parse, today } from './dates';
import { peso } from './format';
import { getSetting, setDueNotifyIds, unpaidDues, type LoanDue } from './db';
import { MASCOT_NAME, tipOfTheDay } from './tips';

// Everything is a local notification planned on the phone:
// - loans: 8 AM the day before a due date and 8 AM on the day itself
// - the morning paalala: 6 AM each day with that day's Tagalog tip

const CHANNEL = 'reminders';
const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

function at8(date: string, dayOffset: number): Date {
  const d = parse(date);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(8, 0, 0, 0);
  return d;
}

async function cancel(ids: string) {
  for (const id of ids.split(',').filter(Boolean)) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

async function scheduleDue(due: LoanDue & { lender: string }) {
  await cancel(due.notify_ids);
  const ids: string[] = [];
  const plan: [number, string][] = [
    [-1, `${due.lender} is due tomorrow`],
    [0, `${due.lender} is due today`],
  ];
  for (const [offset, title] of plan) {
    const when = at8(due.due_date, offset);
    if (when.getTime() <= Date.now()) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body: `Installment ${due.seq}: ${peso(due.amount)}` },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
    });
    ids.push(id);
  }
  await setDueNotifyIds(due.id, ids);
}

/** Re-plan every reminder from the database. Safe to call any time. */
export async function syncReminders() {
  if (!supported) return;
  const granted = await ensurePermission();
  if (!granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const dues = await unpaidDues();
  // Android caps pending alarms, so only plan the next few weeks.
  const horizon = Date.now() + 45 * 24 * 60 * 60 * 1000;
  for (const due of dues) {
    if (parse(due.due_date).getTime() > horizon) {
      await setDueNotifyIds(due.id, []);
      continue;
    }
    await scheduleDue({ ...due, notify_ids: '' });
  }

  if ((await getSetting('morning_tip')) !== '0') {
    for (let i = 0; i < 14; i++) {
      const date = addDays(today(), i);
      const when = parse(date);
      when.setHours(6, 0, 0, 0);
      if (when.getTime() <= Date.now()) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: `Paalala ni ${MASCOT_NAME}`, body: tipOfTheDay(date) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
      });
    }
  }
}
