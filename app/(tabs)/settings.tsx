import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Updates from 'expo-updates';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View, DevSettings } from 'react-native';

const P = { bg: '#0b0b0c', txt: '#fff', dim: '#8b949e' };

function makeFilename() {
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = new Date();
    return `mobilescout-export-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
        d.getHours()
    )}-${pad(d.getMinutes())}-${pad(d.getSeconds())}.json`;
}

async function exportAllAsyncStorageToJson(): Promise<{ filename: string; bytes: number; keys: number }> {
    const keys = await AsyncStorage.getAllKeys();
    const pairs = keys.length ? await AsyncStorage.multiGet(keys) : [];

    const obj: Record<string, unknown> = {};
    for (const [k, v] of pairs) {
        if (v == null) {
            obj[k] = null;
            continue;
        }
        try {
            obj[k] = JSON.parse(v);
        } catch {
            obj[k] = v;
        }
    }

    const payload = { exportedAt: new Date().toISOString(), storage: obj };
    const json = JSON.stringify(payload, null, 2);
    const filename = makeFilename();

    // Web: download
    if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return { filename, bytes: json.length, keys: keys.length };
    }

    // Native: write + share
    const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!baseDir) throw new Error('No writable directory available');

    const fileUri = `${baseDir}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
    });


    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
        await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Export MobileScout data',
            UTI: 'public.json',
        });
    } else {
        Alert.alert('Export created', `Saved to:\n${fileUri}`);
    }

    return { filename, bytes: json.length, keys: keys.length };
}

async function eraseAllLocalData() {
    // 1) Clear AsyncStorage
    const keys = await AsyncStorage.getAllKeys();

    // Optional: only wipe your app’s keys (safer if any libs store keys too)
    // If you want “nuke everything”, remove the filter.
    const appKeys = keys.filter(k => k.startsWith('mobilescout:'));
    if (appKeys.length) {
        await AsyncStorage.multiRemove(appKeys);
    } else if (keys.length) {
        // fallback: remove all if your keys don't use the prefix
        await AsyncStorage.multiRemove(keys);
    }

    // Extra sweep
    await AsyncStorage.clear();

    // 2) OPTIONAL: delete exported files we created (if any)
    // This helps if you’re saving CSV/JSON bundles to the filesystem.
    const dirs = [FileSystem.documentDirectory, FileSystem.cacheDirectory].filter(Boolean) as string[];
    for (const dir of dirs) {
        try {
            const files = await FileSystem.readDirectoryAsync(dir);
            const ours = files.filter(name => name.startsWith('mobilescout-export-'));
            await Promise.all(
                ours.map(name => FileSystem.deleteAsync(dir + name, { idempotent: true }))
            );
        } catch {
            // ignore
        }
    }
}

export default function SettingsTab() {
    const [tz, setTz] = useState<'local' | 'utc'>('local');
    const [status, setStatus] = useState<string>('');

    async function onExportAll() {
        try {
            setStatus('Exporting...');
            const res = await exportAllAsyncStorageToJson();
            setStatus(`Exported ${res.keys} keys to ${res.filename}`);
        } catch (e: any) {
            setStatus('');
            Alert.alert('Export failed', e?.message ?? 'Unknown error');
        }
    }

    async function doErase() {
        setStatus('Erasing...');
        await eraseAllLocalData();
        setStatus('All local data erased.');

        try {
            // Works in production builds with expo-updates
            await Updates.reloadAsync();
        } catch {
            // Works in dev (Expo Go / dev client)
            DevSettings.reload();
        }
    }

    function onEraseAll() {
        const msg =
            'This will delete all locally saved data (pit logs, dynamic samples, queued exports, etc.). This cannot be undone.';

        if (Platform.OS === 'web') {
            // Web confirm is reliable; Alert.alert is often not.
            // eslint-disable-next-line no-alert
            const ok = confirm(`Erase all data?\n\n${msg}`);
            if (ok) void doErase();
            return;
        }

        Alert.alert('Erase all data?', msg, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Erase', style: 'destructive', onPress: () => void doErase() },
        ]);
    }

    return (
        <View style={{ flex: 1, backgroundColor: P.bg, padding: 12 }}>
            <AppHeader />

            <Card>
                <Text style={styles.h2}>Settings</Text>

                <Text style={{ color: P.txt, marginBottom: 8 }}>Timezone display</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    <PrimaryButton title={`Local${tz === 'local' ? ' ✓' : ''}`} onPress={() => setTz('local')} />
                    <PrimaryButton title={`UTC${tz === 'utc' ? ' ✓' : ''}`} onPress={() => setTz('utc')} />
                </View>

                <Text style={styles.hint}>Export/erase local app data stored on this device.</Text>

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <PrimaryButton title="Export ALL Data" onPress={onExportAll} />
                    <PrimaryButton title="Erase All Data" danger onPress={onEraseAll} />
                </View>

                {!!status && <Text style={styles.status}>{status}</Text>}
            </Card>
        </View>
    );
}

const styles = StyleSheet.create({
    h2: { color: P.txt, fontSize: 16, fontWeight: '700', marginBottom: 10 },
    hint: { color: P.dim, fontSize: 14, marginVertical: 12 },
    status: { color: P.dim, marginTop: 10, fontSize: 13 },
});
