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


/**
 * Renders an input accessory view with a "Done" button for iOS platforms.
 * This component provides a convenient way to dismiss the keyboard on iOS devices.
 * On non-iOS platforms, it returns null.
 *
 * @param {Object} props - The component props
 * @param {string} props.nativeID - The native ID for the InputAccessoryView, used to associate it with TextInput components
 * @returns {React.ReactElement | null} An InputAccessoryView component with a Done button on iOS, or null on other platforms
 */
function DoneAccessory({ nativeID }: { nativeID: string }) {
    if (Platform.OS !== 'ios') return null;
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

/**
 * Parses an ISO 8601 date string and returns a Date object.
 * @param ts - The ISO 8601 formatted date string to parse
 * @returns A Date object if the string is a valid ISO date, or null if the string is invalid
 */
function parseISO(ts: string) {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a duration in seconds into a human-readable string.
 * @param totalSeconds - The total duration in seconds. Negative values are treated as 0.
 * @returns A formatted duration string. Returns format "Xh XXm XXs" if hours > 0, otherwise "Xm XXs".
 * @example
 * fmtDuration(3661) // Returns "1h 01m 01s"
 * fmtDuration(125) // Returns "2m 05s"
 * fmtDuration(-5) // Returns "0m 00s"
 */
function fmtDuration(totalSeconds: number) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${sec.toString().padStart(2, '0')}s`;
    return `${m}m ${sec.toString().padStart(2, '0')}s`;
}

/**
 * Computes off-track statistics for a specific car based on pit log entries.
 * 
 * Analyzes pit events (in/out) to determine if a car is currently off-track,
 * how long it has been off-track in the current session, and total off-track time.
 * 
 * @param logs - Array of pit log entries containing car numbers, timestamps, and directions
 * @param carNumber - The car number to analyze (will be trimmed)
 * @param nowMs - Current time in milliseconds for calculating current off-track duration
 * 
 * @returns An object containing:
 *   - `status`: 'OFF TRACK' or 'ON TRACK' string indicator
 *   - `currentOffSeconds`: Duration of current off-track session in seconds (0 if on-track)
 *   - `totalOffSeconds`: Total accumulated off-track time in seconds
 *   - `lastIn`: Timestamp of the last pit-in event, or null if none
 *   - `lastOut`: Timestamp of the last pit-out event, or null if none
 * 
 * @remarks
 * - Empty or whitespace-only car numbers return a default "ON TRACK" status with zero times
 * - Events are processed chronologically by timestamp
 * - If a car has an unclosed pit-in event, it's considered currently off-track
 * - Current off-track time is calculated from the last unclosed pit-in to `nowMs`
 */
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

/**
 * EnduranceTab component for tracking pit events and calculating off-track duration for race cars.
 * 
 * This component manages:
 * - Recording pit in/out events with car numbers and timestamps
 * - Persisting pit logs to AsyncStorage with a 200-entry limit
 * - Calculating total and current off-track duration for a selected car
 * - Real-time duration updates via a 1-second interval timer
 * - Platform-specific keyboard handling (iOS, Android, Web)
 * 
 * @component
 * @returns {JSX.Element} A scrollable view containing:
 *   - Car number input and pit in/out buttons
 *   - Off-track calculation section with metrics (status, current/total off-time, last pit times)
 *   - Recent pit events list with car number shortcuts
 * 
 * @example
 * // Usage within a tab navigator
 * <EnduranceTab />
 * 
 * @remarks
 * - Logs are automatically synced to AsyncStorage on change
 * - The component updates pit durations every second for active calculations
 * - Car number lookup is case-insensitive (trimmed before storage)
 * - Recent logs are limited to the 200 most recent entries
 */
export default function EnduranceTab() {
    const [car, setCar] = useState('');

    const [lookupCar, setLookupCar] = useState('');

    const [logs, setLogs] = useState<Pit[]>([]);

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
