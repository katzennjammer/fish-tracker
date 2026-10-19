import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Button, Card, confirm, Divider, Field, IconButton, notice, PageHeader, Screen, Section, T } from '../components/ui';
import { counts, exportAll, getSetting, importAll, setSetting, type Backup } from '../lib/db';
import { getPin, setPin } from '../lib/pin';
import { syncReminders } from '../lib/notify';
import { useQuery } from '../lib/useQuery';
import { relativeDay, short, today } from '../lib/dates';
import { MASCOT_NAME } from '../lib/tips';
import {
  autoBackup, backupSupported, chooseBackupFolder, deleteBackup, folderLabel, listLocalBackups,
  type BackupFile,
} from '../lib/backup';
import { color, space } from '../lib/theme';

export default function SettingsScreen() {
  const [owner, setOwner] = useState('');
  const [stall, setStall] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [morning, setMorning] = useState(true);
  const stats = useQuery(() => counts(), []);
  const lastBackup = useQuery(() => getSetting('last_backup'), []);
  const folder = useQuery(() => getSetting('backup_folder'), []);
  const folderError = useQuery(() => getSetting('backup_folder_error'), []);
  // Re-read the list whenever settings change (a backup writes a setting).
  const local = useQuery(async () => listLocalBackups(), []);

  useEffect(() => {
    getSetting('owner_name').then((v) => setOwner(v ?? ''));
    getSetting('stall_name').then((v) => setStall(v ?? ''));
    getSetting('morning_tip').then((v) => setMorning(v !== '0'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      getPin().then((p) => setHasPin(!!p));
    }, []),
  );

  async function saveNames() {
    await setSetting('owner_name', owner.trim());
    await setSetting('stall_name', stall.trim());
    notice('Saved', 'Names updated.');
  }

  async function toggleMorning(on: boolean) {
    setMorning(on);
    await setSetting('morning_tip', on ? '1' : '0');
    syncReminders().catch(() => {});
  }

  async function removePin() {
    if (!(await confirm('Turn off PIN?', 'Anyone holding the phone will be able to open the app.', 'Turn off'))) return;
    await setPin(null);
    setHasPin(false);
  }

  async function backup() {
    const data = await exportAll();
    const json = JSON.stringify(data);
    const name = `fish-ledger-${today()}.json`;
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = name;
      a.click();
    } else {
      const file = new File(Paths.cache, name);
      file.create({ overwrite: true });
      file.write(json);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Analou Tracker backup' });
    }
    await setSetting('last_backup', today());
  }

  async function restore() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (result.canceled) return;
    try {
      const asset = result.assets[0];
      const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const data = JSON.parse(text) as Backup;
      const ok = await confirm(
        'Replace everything?',
        `This will replace all records on this phone with the backup from ${data.exported_at?.slice(0, 10) ?? 'the file'}.`,
        'Replace',
      );
      if (!ok) return;
      await autoBackup(true).catch(() => null);
      await importAll(data);
      syncReminders().catch(() => {});
      notice('Restored', 'Your records are back.');
    } catch (e) {
      notice('Could not restore', e instanceof Error ? e.message : 'The file could not be read.');
    }
  }

  async function pickFolder() {
    try {
      if (await chooseBackupFolder()) notice('Folder saved', 'A backup was saved there now, and will be every day.');
    } catch (e) {
      notice('Could not use that folder', e instanceof Error ? e.message : 'Try another folder, like Download.');
    }
  }

  async function backupNow() {
    const r = await autoBackup(true);
    if (r?.folder === 'failed') notice('Saved in the app only', 'The backup folder could not be written. Choose it again.');
    else notice('Backup saved', r?.folder === 'saved' ? 'Saved in the app and in your backup folder.' : 'Saved in the app.');
  }

  async function restoreLocal(b: BackupFile) {
    const ok = await confirm(
      `Go back to ${short(b.date)}?`,
      'All records will be replaced with this copy. Today’s records are saved first, so you can come back.',
      'Restore',
    );
    if (!ok) return;
    try {
      // Read the copy before today's safety backup could overwrite a same-day file.
      const data = JSON.parse(await b.file.text()) as Backup;
      await autoBackup(true);
      await importAll(data);
      syncReminders().catch(() => {});
      notice('Restored', `Records are back to ${short(b.date)}.`);
    } catch (e) {
      notice('Could not restore', e instanceof Error ? e.message : 'The copy could not be read.');
    }
  }

  async function removeLocal(b: BackupFile) {
    if (!(await confirm(`Delete the ${short(b.date)} backup?`, 'This copy will be removed from the phone.'))) return;
    deleteBackup(b.file);
    // Any write refreshes the screen's queries, including the list of copies.
    await setSetting('backups_changed', String(Date.now()));
  }

  return (
    <Screen>
      <PageHeader back eyebrow="Settings" title="Your stall" />

      <Card>
        <Field label="Your name" value={owner} onChangeText={setOwner} placeholder="Ma" autoCapitalize="words" hint="Used in the greeting on Today." />
        <Field label="Stall name" value={stall} onChangeText={setStall} placeholder="e.g. Nena’s Fish Stall" autoCapitalize="words" hint="Shown on statements you send." />
        <Button label="Save names" kind="ghost" small onPress={saveNames} />
      </Card>

      <Section title="Paalala">
        <Card style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <T v="strong">Morning reminder</T>
            <T v="caption">{MASCOT_NAME} sends the day’s Tagalog paalala at 6 AM.</T>
          </View>
          <Switch
            value={morning}
            onValueChange={toggleMorning}
            trackColor={{ true: color.green, false: color.line }}
            thumbColor={color.card}
          />
        </Card>
      </Section>

      <Section title="Privacy">
        <Card>
          <T v="strong">PIN lock {hasPin ? 'is on' : 'is off'}</T>
          <T v="caption" style={{ marginBottom: space.md }}>
            {hasPin ? 'The app asks for your PIN when opened.' : 'Ask for a 4-digit PIN whenever the app opens.'}
          </T>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button small label={hasPin ? 'Change PIN' : 'Set a PIN'} icon="lock" onPress={() => router.push('/pin')} style={{ flex: 1 }} />
            {hasPin ? <Button small kind="danger" label="Turn off" onPress={removePin} style={{ flex: 1 }} /> : null}
          </View>
        </Card>
      </Section>

      <Section title="Automatic backup">
        <Card>
          <T v="body">
            Every day the app saves a copy of all records by itself. The newest 14 copies are kept.
          </T>
          <T v="caption" style={{ marginTop: 6 }}>
            {stats ? `${stats.sales} sales · ${stats.people} people · ${stats.fish} fish` : ' '}
          </T>
          {backupSupported ? (
            <>
              <Divider style={{ marginVertical: space.md }} />
              <T v="strong">Backup folder on the phone</T>
              <T v="caption" style={{ marginBottom: space.md }}>
                {folder
                  ? `${folderLabel(folder)} — copies here stay even if the app is uninstalled.`
                  : 'Choose a folder like Download so copies stay even if the app is uninstalled.'}
              </T>
              {folderError ? (
                <T v="caption" c={color.red} style={{ marginBottom: space.md }}>Last save to the folder failed. Choose it again.</T>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button small kind="secondary" icon="box" label={folder ? 'Change folder' : 'Choose folder'} onPress={pickFolder} style={{ flex: 1 }} />
                <Button small icon="check" label="Back up now" onPress={backupNow} style={{ flex: 1 }} />
              </View>
            </>
          ) : null}
        </Card>
      </Section>

      {local && local.length ? (
        <Section title="Saved copies" right={<T v="caption">Restore or delete</T>}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {local.map((b, i) => (
              <View key={b.file.uri} style={[styles.copy, i < local.length - 1 && styles.copyLine]}>
                <View style={{ flex: 1 }}>
                  <T v="strong">{relativeDay(b.date) ?? short(b.date, true)}</T>
                  <T v="caption">{short(b.date, true)} · {Math.max(1, Math.round(b.size / 1024))} KB</T>
                </View>
                <Button small kind="ghost" label="Restore" onPress={() => restoreLocal(b)} />
                <IconButton icon="trash" label="Delete backup" onPress={() => removeLocal(b)} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="Send a copy">
        <Card>
          <T v="body">
            Once a week, send a copy to Messenger, Google Drive or email. If the phone is lost, install the app on a new phone and tap Restore.
          </T>
          <T v="caption" style={{ marginTop: 8 }}>
            {lastBackup ? `Last copy outside the app: ${relativeDay(lastBackup)?.toLowerCase() ?? short(lastBackup)}` : 'No copy outside the app yet'}
          </T>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: space.md }}>
            <Button small label="Send backup" icon="upload" onPress={backup} style={{ flex: 1 }} />
            <Button small kind="secondary" label="Restore file" icon="download" onPress={restore} style={{ flex: 1 }} />
          </View>
        </Card>
      </Section>

      <T v="caption" style={{ textAlign: 'center', marginTop: space.xxl }} c={color.inkFaint}>
        Analou Tracker · made for Mama
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  copyLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.lineSoft },
});
