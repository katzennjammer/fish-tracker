import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Button, Card, confirm, Field, notice, PageHeader, Screen, Section, T } from '../components/ui';
import { counts, exportAll, getSetting, importAll, setSetting, type Backup } from '../lib/db';
import { getPin, setPin } from '../lib/pin';
import { syncReminders } from '../lib/notify';
import { useQuery } from '../lib/useQuery';
import { today } from '../lib/dates';
import { MASCOT_NAME } from '../lib/tips';
import { color, space } from '../lib/theme';

export default function SettingsScreen() {
  const [owner, setOwner] = useState('');
  const [stall, setStall] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [morning, setMorning] = useState(true);
  const stats = useQuery(() => counts(), []);
  const lastBackup = useQuery(() => getSetting('last_backup'), []);

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
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Fish Ledger backup' });
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
      await importAll(data);
      syncReminders().catch(() => {});
      notice('Restored', 'Your records are back.');
    } catch (e) {
      notice('Could not restore', e instanceof Error ? e.message : 'The file could not be read.');
    }
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

      <Section title="Backup">
        <Card>
          <T v="body">
            Everything is saved only on this phone. Save a backup now and then to Messenger, Google Drive or email, so nothing is lost if the phone breaks.
          </T>
          <T v="caption" style={{ marginTop: 8 }}>
            {stats ? `${stats.sales} sales · ${stats.people} people · ${stats.fish} fish` : ' '}
            {lastBackup ? ` · last backup ${lastBackup}` : ' · no backup yet'}
          </T>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: space.md }}>
            <Button small label="Save backup" icon="upload" onPress={backup} style={{ flex: 1 }} />
            <Button small kind="secondary" label="Restore" icon="download" onPress={restore} style={{ flex: 1 }} />
          </View>
        </Card>
      </Section>

      <T v="caption" style={{ textAlign: 'center', marginTop: space.xxl }} c={color.inkFaint}>
        Fish Ledger · made for Mama
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
