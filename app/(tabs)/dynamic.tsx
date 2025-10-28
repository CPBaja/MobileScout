import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

const palette = {
    bg: '#0b0b0c', text: '#ffffff', dim: '#c9d1d9',
    inputBg: '#161b22', border: '#30363d', listBg: '#11161d',
    success: '#238636'
};

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
    const onlineRef = useRef(true);

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

    function snapshot() {
        const win = Math.max(1, Math.min(60, Number(windowMin) || 10));
        const ll = Number(lineLength) || 0;
        const e = (eventName.trim() || 'Event');
        const entry: LineSample = {
            eventName: e,
            lineLength: ll,
            windowMin: win,
            runRate: Number(rate.toFixed(4)),
            etaMinutes: Number.isFinite(eta!) ? Number(eta!.toFixed(2)) : null,
            timestamp: new Date().toISOString(),
        };
        setSamples(prev => [entry, ...prev].slice(0, 50));
    }

    function plusOne() {
        const e = (eventName.trim() || 'Event');
        setCompletions(prev => [{ eventName: e, timestamp: new Date().toISOString() }, ...prev]);
    }

    const recent = useMemo(() => {
        const items = [
            ...samples.map(s => ({ ts: s.timestamp, text: `[Snapshot] ${s.eventName}: line=${s.lineLength}` })),
            ...completions.map(c => ({ ts: c.timestamp, text: `[Completion] ${c.eventName}` })),
        ].sort((a, b) => +new Date(b.ts) - +new Date(a.ts)).slice(0, 10);
        return items;
    }, [samples, completions]);

    return (
        <View style={styles.screen}>
            <AppHeader />
            <Card>
                <Text style={styles.h2}>Event</Text>

                <Text style={styles.label}>Event name</Text>
                <TextInput
                    value={eventName}
                    onChangeText={setEventName}
                    placeholder="Acceleration / Maneuverability / Suspension"
                    placeholderTextColor={palette.dim}
                    style={styles.input}
                />

                <Text style={styles.label}>Current line length</Text>
                <TextInput
                    value={String(lineLength)}
                    onChangeText={setLineLength}
                    keyboardType="numeric"
                    style={styles.input}
                />

                <View style={styles.row}>
                    <PrimaryButton title="Snapshot Line Length" onPress={snapshot} />
                    <PrimaryButton title="+1 Completion" onPress={plusOne} />
                </View>

                <View style={styles.metrics}>
                    <Text style={styles.metric}><Text style={styles.metricKey}>Window (min): </Text>
                        <TextInput value={String(windowMin)} onChangeText={setWindowMin} keyboardType="numeric" style={[styles.input, styles.inputInline]} />
                    </Text>
                    <Text style={styles.metric}><Text style={styles.metricKey}>Run rate:</Text> {rate.toFixed(2)} / min</Text>
                    <Text style={styles.metric}><Text style={styles.metricKey}>ETA:</Text> {eta && isFinite(eta) ? eta.toFixed(1) : '–'} minutes</Text>
                    <Text style={styles.metric}><Text style={styles.metricKey}>Completions in window:</Text> {count}</Text>
                </View>

                <View style={styles.row}>
                    <PrimaryButton title="Export LineSamples CSV" onPress={() => { }} />
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
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.bg, padding: 12 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 8, borderBottomColor: '#222', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8
    },
    h1: { color: palette.text, fontSize: 18, fontWeight: '700' },
    h2: { color: palette.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
    h3: { color: palette.text, fontSize: 15, fontWeight: '700', marginTop: 10 },
    label: { color: palette.dim, marginBottom: 6 },
    input: {
        backgroundColor: palette.inputBg, color: palette.text, borderColor: palette.border,
        borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 10
    },
    inputInline: { width: 80, paddingVertical: 6, marginLeft: 6 },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 4 },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
    metric: { color: palette.text, backgroundColor: 'transparent' },
    metricKey: { fontWeight: '700' },
    listItem: {
        backgroundColor: '#11161d', borderColor: palette.border, borderWidth: 1, borderRadius: 12, padding: 10,
    },
    itemText: { color: palette.text },
});
