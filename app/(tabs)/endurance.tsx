import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import { useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    View,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Button,
    NativeSyntheticEvent,
    TextInputKeyPressEventData,
    Alert,
    Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import DismissKeyboard from '@/components/ui/DismissKeyboard';

const P = { bg: '#0b0b0c', txt: '#fff', dim: '#c9d1d9', input: '#161b22', border: '#30363d', green: '#238636' };

type Direction = 'in' | 'out';
type Station = 'entry' | 'exit';
type Pit = { carNumber: string; direction: Direction; station: Station; timestamp: string; sessionId: string };

const CAR_INPUT_ACCESSORY = 'carNumberAccessory';
const STORAGE_KEY_PITLOGS = 'mobilescout:pitlogs:v1';

// Lazy “Done” toolbar, imported only on iOS (web-safe)
function DoneAccessory({ nativeID }: { nativeID: string }) {
    if (Platform.OS !== 'ios') return null;
    // Lazy require keeps it out of web bundle
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { InputAccessoryView } = require('react-native');
    return (
        <InputAccessoryView nativeID={nativeID}>
            <View style={styles.accessoryBar}>
                <View style={{ flex: 1 }} />
                <Button title="Done" onPress={Keyboard.dismiss} />
            </View>
        </InputAccessoryView>
    );
}

function parseISO(ts: string) {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
}

function fmtDuration(totalSeconds: number) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${sec.toString().padStart(2, '0')}s`;
    return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

// Core off-track logic: sum pit-in -> next pit-out; if open pit-in, count until now
function computeOffTrack(logs: Pit[], carNumber: string, nowMs: number) {
    const car = carNumber.trim();
    if (!car) {
        return {
            status: '—',
            currentOffSeconds: 0,
            totalOffSeconds: 0,
            lastIn: null as Date | null,
            lastOut: null as Date | null,
        };
    }

    const events = logs
        .filter(l => l.carNumber.trim() === car)
        .map(l => ({ ...l, dt: parseISO(l.timestamp) }))
        .filter((x): x is Pit & { dt: Date } => x.dt !== null);

    events.sort((a, b) => a.dt.getTime() - b.dt.getTime());

    let openIn: Date | null = null;
    let total = 0;
    let current = 0;
    let lastIn: Date | null = null;
    let lastOut: Date | null = null;

    for (const e of events) {
        if (e.direction === 'in') {
            openIn = e.dt;
            lastIn = e.dt;
        } else if (e.direction === 'out') {
            lastOut = e.dt;
            if (openIn && e.dt.getTime() >= openIn.getTime()) {
                total += (e.dt.getTime() - openIn.getTime()) / 1000;
                openIn = null;
            }
        }
    }

    if (openIn) {
        current = Math.max(0, (nowMs - openIn.getTime()) / 1000);
        total += current;
    }

    return {
        status: openIn ? 'OFF TRACK' : 'ON TRACK',
        currentOffSeconds: current,
        totalOffSeconds: total,
        lastIn,
        lastOut,
    };
}

export default function EnduranceTab() {
    // car input for logging
    const [car, setCar] = useState('');

    // ✅ separate input for off-track lookup (so you can check any car without overwriting log input)
    const [lookupCar, setLookupCar] = useState('');

    const [logs, setLogs] = useState<Pit[]>([]);

    // live “now” tick for active off-track updates
    const [nowMs, setNowMs] = useState(() => Date.now());

    // hydrate pit logs on mount
    useEffect(() => {
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(STORAGE_KEY_PITLOGS);
                if (raw) setLogs(JSON.parse(raw));
            } catch { }
        })();
    }, []);

    // persist logs whenever they change
    useEffect(() => {
        (async () => {
            try {
                await AsyncStorage.setItem(STORAGE_KEY_PITLOGS, JSON.stringify(logs));
            } catch { }
        })();
    }, [logs]);

    // timer to update active durations
    useEffect(() => {
        const id = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    function add(direction: Direction) {
        if (!car.trim()) return;

        const trimmed = car.trim();        
        setLookupCar(trimmed);          

        const newEntry: Pit = {
            carNumber: trimmed,
            direction,
            station: direction === 'in' ? 'entry' : 'exit',
            timestamp: new Date().toISOString(),
            sessionId: new Date().toISOString().slice(0, 10),
        };

        setLogs(prev => [newEntry, ...prev].slice(0, 200));
        setCar('');
        Keyboard.dismiss();
    }


    // Web: allow Enter/Escape to blur
    function onWebKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
        if (Platform.OS !== 'web') return;
        const key = e.nativeEvent.key;
        if (key === 'Enter' || key === 'Escape') {
            (e.target as unknown as HTMLInputElement)?.blur?.();
            Keyboard.dismiss();
        }
    }

    const carKeyboardType = Platform.select({
        ios: 'number-pad',
        android: 'numeric',
        web: 'numeric',
    }) as any;

    // Active off-track calculation (updates every second via nowMs)
    const off = useMemo(() => computeOffTrack(logs, lookupCar, nowMs), [logs, lookupCar, nowMs]);

    return (
        <DismissKeyboard>
            <KeyboardAvoidingView
                style={{ flex: 1, backgroundColor: P.bg }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.select({ ios: 70, android: 0 })}
            >
                <View style={{ flex: 1, backgroundColor: P.bg, padding: 12 }}>
                    <AppHeader />
                    <Card>
                        <Text style={styles.h2}>Pit Logs</Text>

                        <Text style={styles.label}>Car number</Text>
                        <TextInput
                            value={car}
                            onChangeText={setCar}
                            placeholder="e.g., 42"
                            placeholderTextColor={P.dim}
                            style={styles.input}
                            keyboardType={carKeyboardType}
                            inputMode="numeric"
                            returnKeyType="done"
                            blurOnSubmit
                            onSubmitEditing={Keyboard.dismiss}
                            onKeyPress={onWebKeyPress}
                            inputAccessoryViewID={Platform.OS === 'ios' ? CAR_INPUT_ACCESSORY : undefined}
                        />
                        <DoneAccessory nativeID={CAR_INPUT_ACCESSORY} />

                        <View style={styles.row}>
                            <PrimaryButton title="Pit In" onPress={() => add('in')} />
                            <PrimaryButton title="Pit Out" onPress={() => add('out')} />
                        </View>

                        {/* ---------------- Off-Track Calculation ---------------- */}
                        <View style={styles.section}>
                            <Text style={styles.h3}>Off-Track Calculation</Text>

                            <Text style={styles.label}>Lookup car number</Text>
                            <TextInput
                                value={lookupCar}
                                onChangeText={setLookupCar}
                                placeholder="e.g., 42"
                                placeholderTextColor={P.dim}
                                style={styles.input}
                                keyboardType={carKeyboardType}
                                inputMode="numeric"
                                returnKeyType="done"
                                blurOnSubmit
                                onSubmitEditing={Keyboard.dismiss}
                                onKeyPress={onWebKeyPress}
                            />

                            <View style={styles.metrics}>
                                <Text style={styles.metric}>
                                    <Text style={styles.metricKey}>Status: </Text>
                                    <Text style={{ color: off.status === 'OFF TRACK' ? P.green : P.txt }}>
                                        {off.status}
                                    </Text>
                                </Text>

                                <Text style={styles.metric}>
                                    <Text style={styles.metricKey}>Current off-track: </Text>
                                    {off.status === 'OFF TRACK' ? fmtDuration(off.currentOffSeconds) : '—'}
                                </Text>

                                <Text style={styles.metric}>
                                    <Text style={styles.metricKey}>Total off-track: </Text>
                                    {lookupCar.trim() ? fmtDuration(off.totalOffSeconds) : '—'}
                                </Text>

                                <Text style={styles.metric}>
                                    <Text style={styles.metricKey}>Last Pit In: </Text>
                                    {off.lastIn ? off.lastIn.toLocaleString() : '—'}
                                </Text>

                                <Text style={styles.metric}>
                                    <Text style={styles.metricKey}>Last Pit Out: </Text>
                                    {off.lastOut ? off.lastOut.toLocaleString() : '—'}
                                </Text>
                            </View>
                        </View>

                        {/* ---------------- Recent logs ---------------- */}
                        <Text style={styles.h3}>Recent pit events</Text>
                        <FlatList
                            data={logs}
                            keyExtractor={(i, idx) => i.timestamp + idx}
                            contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
                            keyboardShouldPersistTaps="always"
                            renderItem={({ item }) => (
                                <Pressable onPress={() => setLookupCar(item.carNumber)} style={styles.item}>
                                    <Text style={{ color: P.txt }}>
                                        {new Date(item.timestamp).toLocaleString()} — Car {item.carNumber}: {item.direction.toUpperCase()} ({item.station})
                                    </Text>
                                </Pressable>
                            )}

                        />
                    </Card>
                </View>
            </KeyboardAvoidingView>
        </DismissKeyboard>
    );
}

const styles = StyleSheet.create({
    h2: { color: P.txt, fontSize: 16, fontWeight: '700', marginBottom: 10 },
    h3: { color: P.txt, fontSize: 15, fontWeight: '700', marginTop: 10, marginBottom: 6 },
    label: { color: P.dim, marginBottom: 6 },
    input: {
        backgroundColor: P.input,
        color: P.txt,
        borderColor: P.border,
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
    },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 4 },
    item: {
        backgroundColor: '#11161d',
        borderColor: P.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
    },
    accessoryBar: {
        backgroundColor: '#11161d',
        borderTopColor: P.border,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 8,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
    section: { marginTop: 10, paddingTop: 10, borderTopColor: P.border, borderTopWidth: StyleSheet.hairlineWidth },
    metrics: { gap: 6, marginTop: 6 },
    metric: { color: P.txt },
    metricKey: { fontWeight: '700' },
});
