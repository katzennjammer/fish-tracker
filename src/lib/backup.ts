import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { exportAll, getSetting, setSetting } from './db';
import { today } from './dates';

// Automatic backups. Once a day (and whenever she closes the day) the whole
// ledger is written as dated JSON:
//  - inside the app, so a wrong delete can be undone from yesterday's copy;
//  - to a folder she picks on the phone (e.g. Download), which survives the
//    app being uninstalled and can be copied to Google Drive.
// The newest KEEP copies are kept in each place.

const KEEP = 14;
const PREFIX = 'fish-ledger-';
export const backupSupported = Platform.OS !== 'web';

export type BackupFile = { file: File; date: string; size: number };

function localDir(): Directory {
  const dir = new Directory(Paths.document, 'backups');
  if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
  return dir;
}

function backupsIn(dir: Directory): File[] {
  return dir
    .list()
    .filter((f): f is File => f instanceof File && f.name.startsWith(PREFIX) && f.name.endsWith('.json'))
    .sort((a, b) => b.name.localeCompare(a.name));
}

function writeInto(dir: Directory, name: string, json: string) {
  for (const f of backupsIn(dir)) if (f.name === name) f.delete();
  dir.createFile(name, 'application/json').write(json);
  for (const old of backupsIn(dir).slice(KEEP)) old.delete();
}

export type AutoBackupResult = { local: boolean; folder: 'saved' | 'none' | 'failed' };

/** Write today's copy unless one exists already; `force` rewrites it. */
export async function autoBackup(force = false): Promise<AutoBackupResult | null> {
  if (!backupSupported) return null;
  const date = today();
  if (!force && (await getSetting('auto_backup_date')) === date) return null;

  const json = JSON.stringify(await exportAll());
  const name = `${PREFIX}${date}.json`;
  writeInto(localDir(), name, json);

  let folder: AutoBackupResult['folder'] = 'none';
  const folderUri = await getSetting('backup_folder');
  if (folderUri) {
    try {
      writeInto(new Directory(folderUri), name, json);
      folder = 'saved';
      await setSetting('last_backup', date);
      await setSetting('backup_folder_error', '');
    } catch (e) {
      folder = 'failed';
      await setSetting('backup_folder_error', e instanceof Error ? e.message : 'Could not write to the folder');
    }
  }
  await setSetting('auto_backup_date', date);
  return { local: true, folder };
}

export function listLocalBackups(): BackupFile[] {
  if (!backupSupported) return [];
  return backupsIn(localDir()).map((file) => ({
    file,
    date: file.name.slice(PREFIX.length, PREFIX.length + 10),
    size: file.size ?? 0,
  }));
}

export function deleteBackup(file: File) {
  file.delete();
}

/** Let her choose a folder (e.g. Download) that keeps copies outside the app. */
export async function chooseBackupFolder(): Promise<boolean> {
  const dir = await Directory.pickDirectoryAsync();
  if (!dir?.uri) return false;
  await setSetting('backup_folder', dir.uri);
  await autoBackup(true);
  return true;
}

/** "content://…/tree/primary%3ADownload%2FFishLedger" → "Download/FishLedger" */
export function folderLabel(uri: string): string {
  const tree = uri.split('/tree/')[1] ?? uri;
  const decoded = decodeURIComponent(tree.split('/document/')[0]);
  return decoded.replace(/^primary:/, 'Phone storage/').replace(/^[^:]+:/, 'SD card/') || 'Chosen folder';
}
