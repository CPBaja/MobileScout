import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { useOnline } from '@/offline/OnlineProvider';
import OfflineOverlay from '@/offline/OfflineOverlay';
import DropDownPicker from 'react-native-dropdown-picker';
import NetInfo from '@react-native-community/netinfo';

// local libs
import { STORAGE_KEYS, loadArray, saveArray } from '@/lib/persistence';
import { buildSamplesCSV, buildCompletionsCSV, writeTextFile, shareIfAvailable } from '@/lib/exporters';

// ---- theme ----
const palette = {
    bg: '#0b0b0c', text: '#ffffff', dim: '#c9d1d9',
    inputBg: '#161b22', border: '#30363d', listBg: '#11161d',
    success: '#238636'
};

const isOnline = useOnline();

// ---- types ----
type LineSample = {
    eventName: string; timestamp: string; lineLength: number; windowMin: number;
    runRate: number; etaMinutes: number | null;
};
type Completion = { eventName: string; timestamp: string };

export default function DynamicTab() {
    const [eventName, setEventName] = useState('');
    const [lineLength, setLineLength] = useState('0');
    const [windowMin, setWindowMin] = useState('10');
    const [samples, setSamples] = useState<LineSample[]>([]);
    const [completions, setCompletions] = useState<Completion[]>([]);
    const onlineRef = useRef<boolean | null>(null);

    // dropdown state
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([
        { label: 'Acceleration', value: 'Acceleration' },
        { label: 'Maneuverability', value: 'Maneuverability' },
        { label: 'Suspension', value: 'Suspension' },
    ]);

    // ---- hydrate on mount ----
    useEffect(() => {
        (async () => {
            const [savedSamples, savedCompletions] = await Promise.all([
                loadArray<LineSample>(STORAGE_KEYS.samples),
                loadArray<Completion>(STORAGE_KEYS.completions),
            ]);
            setSamples(savedSamples);
            setCompletions(savedCompletions);
        })();
    }, []);

    // ---- persist whenever arrays change ----
    useEffect(() => { saveArray(STORAGE_KEYS.samples, samples); }, [samples]);
    useEffect(() => { saveArray(STORAGE_KEYS.completions, completions); }, [completions]);

    // ---- metrics ----
    const { rate, count } = useMemo(() => {
        const win = Math.max(1, Math.min(60, Number(windowMin) || 10));
        const cutoff = Date.now() - win * 60 * 1000;
        const hits = completions.filter(
            c => c.eventName.trim() === (eventName.trim() || 'Event') && new Date(c.timestamp).getTime() >= cutoff
        );
        return { rate: hits.length / win, count: hits.length };
    }, [completions, windowMin, eventName]);

    const eta = useMemo(() => {
        const ll = Number(lineLength) || 0;
        return rate > 0 ? (ll / rate) : undefined;
    }, [rate, lineLength]);

    // ---- actions ----
    function requireEventOrAlert(): string | null {
        const e = eventName.trim();
        if (!e) {
            Alert.alert('Event required', 'Please select an event before performing this action.');
            return null;
        }
        return e;
    }

    function snapshot() {
        const e = (eventName.trim() || 'Event');
        const win = Math.max(1, Math.min(60, Number(windowMin) || 10));
        const ll = Number(lineLength) || 0;
        const entry: LineSample = {
            eventName: e,
            lineLength: ll,
            windowMin: win,
            runRate: Number(rate.toFixed(4)),
            etaMinutes: Number.isFinite(eta!) ? Number(eta!.toFixed(2)) : null,
            timestamp: new Date().toISOString(),
        };
        setSamples(prev => [entry, ...prev].slice(0, 100));
    }

    // Add one car (requires event)
    function incrementLine() {
        if (!requireEventOrAlert()) return;
        setLineLength(prev => String((Number(prev) || 0) + 1));
    }

    // Remove one car (requires event, never below zero)
    function decrementLine() {
        if (!requireEventOrAlert()) return;
        setLineLength(prev => String(Math.max(0, (Number(prev) || 0) - 1)));
    }

    // Completion also removes one from the queue (requires event)
    function plusOne() {
        const e = requireEventOrAlert();
        if (!e) return;
        setCompletions(prev => [{ eventName: e, timestamp: new Date().toISOString() }, ...prev]);
        setLineLength(prev => String(Math.max(0, (Number(prev) || 0) - 1)));
    }

    // ---- export / share ----
    async function exportAllCSV() {
        // two CSVs, one for samples and one for completions
        const samplesCSV = buildSamplesCSV(samples);
        const completionsCSV = buildCompletionsCSV(completions);

        const samplesUri = await writeTextFile(`line-samples-${Date.now()}.csv`, samplesCSV);
        const completionsUri = await writeTextFile(`completions-${Date.now()}.csv`, completionsCSV);

        await shareIfAvailable(samplesUri);
        await shareIfAvailable(completionsUri);

        Alert.alert('Export complete', 'CSV files have been saved to app documents and shared (if available).');
        return { samplesUri, completionsUri };
    }

    // ---- auto-flush when connection returns ----
    async function flushOnReconnect() {
        if (samples.length === 0 && completions.length === 0) return;
        try {
            // Example behavior: export both CSVs when back online, then clear.
            await exportAllCSV();
            setSamples([]);
            setCompletions([]);
        } catch (e) {
            console.warn('Flush failed; will retry later.', e);
        }
    }

    useEffect(() => {
        const sub = NetInfo.addEventListener(state => {
            const isOnline = !!(state.isConnected && state.isInternetReachable);
            if (onlineRef.current === false && isOnline) {
                // transitioned offline -> online
                flushOnReconnect();
            }
            onlineRef.current = isOnline;
        });
        return () => sub && sub();
    }, [samples, completions]);

    // ---- recent list ----
    const recent = useMemo(() => {
        const items = [
            ...samples.map(s => ({ ts: s.timestamp, text: `[Snapshot] ${s.eventName}: line=${s.lineLength}` })),
            ...completions.map(c => ({ ts: c.timestamp, text: `[Completion] ${c.eventName}` })),
        ].sort((a, b) => +new Date(b.ts) - +new Date(a.ts)).slice(0, 10);
        return items;
    }, [samples, completions]);

    const currentLine = Number(lineLength) || 0;

    return (
        <View style={styles.screen}>
            <AppHeader />
            <Card>
                <Text style={styles.h2}>Event</Text>
                <View style={{ zIndex: 1000 }}>
                    <DropDownPicker
                        open={open}
                        value={eventName}
                        items={items}
                        setOpen={setOpen}
                        setValue={setEventName}
                        setItems={setItems}
                        style={{ backgroundColor: '#161b22', borderColor: '#30363d' }}
                        dropDownContainerStyle={{ backgroundColor: '#11161d', borderColor: '#30363d' }}
                        listItemLabelStyle={{ color: '#ffffffff' }}
                        textStyle={{ color: '#ffffffff' }}
                        placeholder="Select event..."
                        placeholderStyle={{ color: '#c9d1d9' }}
                        theme="DARK"
                    />
                </View>

                {/* Current line display */}
                <Text style={[styles.metric, { marginTop: 8 }]}>
                    <Text style={styles.metricKey}>Current line of cars: </Text>
                    {currentLine}
                </Text>

                <View style={styles.row}>
                    <PrimaryButton title="+1 Car in Line" onPress={incrementLine} />
                    <PrimaryButton title="Remove from Queue" onPress={decrementLine} />
                    <PrimaryButton title="Snapshot Line Length" onPress={snapshot} />
                    <PrimaryButton title="+1 Completion" onPress={plusOne} />
                </View>

                <View style={styles.metrics}>
                    <Text style={styles.metric}>
                        <Text style={styles.metricKey}>Window (min): </Text>
                        <TextInput
                            value={String(windowMin)}
                            onChangeText={setWindowMin}
                            keyboardType="numeric"
                            style={[styles.input, styles.inputInline]}
                        />
                    </Text>
                    <Text style={styles.metric}>
                        <Text style={styles.metricKey}>Run rate:</Text> {rate.toFixed(2)} / min
                    </Text>
                    <Text style={styles.metric}>
                        <Text style={styles.metricKey}>ETA:</Text> {eta && isFinite(eta) ? eta.toFixed(1) : '–'} minutes
                    </Text>
                    <Text style={styles.metric}>
                        <Text style={styles.metricKey}>Completions in window:</Text> {count}
                    </Text>
                </View>

                <View style={styles.row}>
                    <PrimaryButton title="Export CSV Now" onPress={exportAllCSV} />
                    <PrimaryButton title="Retry Sync" onPress={flushOnReconnect} />
                </View>

                <Text style={styles.h3}>Recent activity</Text>
                <FlatList
                    data={recent}
                    keyExtractor={(i, idx) => i.ts + idx}
                    contentContainerStyle={{ gap: 8 }}
                    renderItem={({ item }) => (
                        <View style={styles.listItem}>
                            <Text style={styles.itemText}>
                                {new Date(item.ts).toLocaleString()} — {item.text}
                            </Text>
                        </View>
                    )}
                />
            </Card>
            {!isOnline && <OfflineOverlay />}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.bg, padding: 12 },
    h2: { color: palette.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
    h3: { color: palette.text, fontSize: 15, fontWeight: '700', marginTop: 10 },
    label: { color: palette.dim, marginBottom: 6 },
    input: {
        backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.border,
        borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10,
    },
    pickerContainer: {
        backgroundColor: palette.inputBg,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 10,
        marginBottom: 10,
    },
    picker: {
        color: palette.success,
        height: 50,
        width: '100%',
    },
    inputInline: { width: 80, paddingVertical: 6, marginLeft: 6 },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 4 },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
    metric: { color: palette.text },
    metricKey: { fontWeight: '700' },
    listItem: {
        backgroundColor: palette.listBg, borderColor: palette.border, borderWidth: 1, borderRadius: 12, padding: 10,
    },
    itemText: { color: palette.text },
});
