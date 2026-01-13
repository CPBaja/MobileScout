import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View, Switch, Platform } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { useOnline } from '@/offline/OnlineProvider';

const palette = {
    bg: '#0b0b0c',
    text: '#ffffff',
    dim: '#c9d1d9',
    inputBg: '#161b22',
    border: '#30363d',
    listBg: '#11161d',
    success: '#238636',
};

type LineSample = {
    eventName: string;
    timestamp: string;
    lineLength: number;
    runRate: number;
    etaMinutes: number | null;
};
type Completion = { eventName: string; timestamp: string };

type SAESeen = { carNo: string; firstSeenTs: string };

const SAE_EVENT_CODE: Record<string, string> = {
    Acceleration: 'ACCEL',
    Maneuverability: 'MANU',
    Suspension: 'SPEC',
};

const SAE_BASE = 'https://results.bajasae.net/Leaderboard.aspx?Event=';

// Optional: if you set EXPO_PUBLIC_SAE_PROXY_BASE, we’ll use it on web to avoid CORS.
// Example value: https://your-proxy.example.com/sae?event=  (must end with ?event=)
const SAE_PROXY_BASE =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (typeof process !== 'undefined' ? (process as any).env?.EXPO_PUBLIC_SAE_PROXY_BASE : undefined) as
    | string
    | undefined;

function parseCarsWithResults(html: string): string[] {
    // Convert HTML to text-ish and normalize whitespace
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    // Heuristic regex: "<pos> <carNo> ... OK <time>"
    // We care about carNo. This keeps the parsing light and dependency-free.
    const re = /\b(\d{1,3})\s+(\d{1,4})\s+.*?\s+OK\s+(\d+(?:\.\d+)?)\b/g;

    const cars = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
        const carNo = m[2];
        const time = Number(m[3]);
        if (Number.isFinite(time) && time > 0) cars.add(carNo);
    }
    return [...cars];
}

async function fetchLeaderboardCars(eventCode: string): Promise<string[]> {
    const directUrl = `${SAE_BASE}${encodeURIComponent(eventCode)}`;
    const proxyUrl = SAE_PROXY_BASE ? `${SAE_PROXY_BASE}${encodeURIComponent(eventCode)}` : undefined;

    // On web, prefer proxy if provided (CORS).
    const urlToUse = Platform.OS === 'web' && proxyUrl ? proxyUrl : directUrl;

    const res = await fetch(urlToUse);
    if (!res.ok) throw new Error(`SAE fetch failed: ${res.status}`);
    const html = await res.text();
    return parseCarsWithResults(html);
}

function updateSeenCars(existing: SAESeen[], carsNow: string[], nowIso: string) {
    const seenSet = new Set(existing.map((x) => x.carNo));
    const additions: SAESeen[] = [];

    for (const carNo of carsNow) {
        if (!seenSet.has(carNo)) {
            additions.push({ carNo, firstSeenTs: nowIso });
            seenSet.add(carNo);
        }
    }

    // Keep bounded history
    return [...additions, ...existing].slice(0, 800);
}

export default function DynamicTab() {
    const isOnline = useOnline();

    const [eventName, setEventName] = useState('');
    const [lineLength, setLineLength] = useState('0');
    const [samples, setSamples] = useState<LineSample[]>([]);
    const [completions, setCompletions] = useState<Completion[]>([]);

    // SAE-derived completions (seen cars)
    const [useSAERunRate, setUseSAERunRate] = useState(true);
    const [saeSeen, setSaeSeen] = useState<SAESeen[]>([]);
    const [saeStatus, setSaeStatus] = useState<string>('SAE idle');

    const onlineRef = useRef(true);

    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([
        { label: 'Acceleration', value: 'Acceleration' },
        { label: 'Maneuverability', value: 'Maneuverability' },
        { label: 'Suspension', value: 'Suspension' },
    ]);

    // Poll SAE leaderboard when online + enabled + event selected
    useEffect(() => {
        onlineRef.current = isOnline;

        if (!useSAERunRate) {
            setSaeStatus('SAE disabled (manual mode)');
            return;
        }

        const code = SAE_EVENT_CODE[eventName];
        if (!code) {
            setSaeStatus('Select an event to pull SAE results');
            return;
        }

        if (!isOnline) {
            setSaeStatus('Offline (SAE paused)');
            return;
        }

        let cancelled = false;

        const tick = async () => {
            try {
                setSaeStatus('Fetching SAE results…');
                const carsNow = await fetchLeaderboardCars(code);
                if (cancelled) return;

                const nowIso = new Date().toISOString();
                setSaeSeen((prev) => updateSeenCars(prev, carsNow, nowIso));
                setSaeStatus(`SAE OK — ${carsNow.length} cars with results`);
            } catch (e: any) {
                // Web CORS or network failures will land here
                const msg =
                    Platform.OS === 'web' && !SAE_PROXY_BASE
                        ? 'SAE blocked on web (CORS). Set EXPO_PUBLIC_SAE_PROXY_BASE or use manual.'
                        : `SAE fetch failed. Using manual if needed.`;

                setSaeStatus(msg);
            }
        };

        // Run once immediately + poll
        tick();
        const id = setInterval(tick, 20000); // 20s poll; adjust as desired

        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [eventName, isOnline, useSAERunRate]);

    const { rate, count, sourceLabel } = useMemo(() => {
        // SAE-based run rate (cars per minute)
        if (useSAERunRate && isOnline && SAE_EVENT_CODE[eventName]) {
            if (saeSeen.length === 0) {
                return { rate: 0, count: 0, sourceLabel: 'SAE' as const };
            }

            const times = saeSeen
                .map(s => new Date(s.firstSeenTs).getTime())
                .sort((a, b) => a - b);

            const durationMin = Math.max(
                1 / 60, // avoid divide-by-zero
                (times[times.length - 1] - times[0]) / 60000
            );

            return {
                rate: times.length / durationMin,
                count: times.length,
                sourceLabel: 'SAE' as const,
            };
        }

        // Manual completions fallback
        if (completions.length === 0) {
            return { rate: 0, count: 0, sourceLabel: 'Manual' as const };
        }

        const times = completions
            .filter(c => c.eventName.trim() === (eventName.trim() || 'Event'))
            .map(c => new Date(c.timestamp).getTime())
            .sort((a, b) => a - b);

        if (times.length === 0) {
            return { rate: 0, count: 0, sourceLabel: 'Manual' as const };
        }

        const durationMin = Math.max(
            1 / 60,
            (times[times.length - 1] - times[0]) / 60000
        );

        return {
            rate: times.length / durationMin,
            count: times.length,
            sourceLabel: 'Manual' as const,
        };
    }, [saeSeen, completions, eventName, useSAERunRate, isOnline]);


    const eta = useMemo(() => {
        const ll = Number(lineLength) || 0;
        return rate > 0 ? ll / rate : undefined;
    }, [rate, lineLength]);

    function snapshot() {
        const ll = Number(lineLength) || 0;
        const e = eventName.trim() || 'Event';

        const entry: LineSample = {
            eventName: e,
            lineLength: ll,
            runRate: Number(rate.toFixed(4)),
            etaMinutes: Number.isFinite(eta!) ? Number(eta!.toFixed(2)) : null,
            timestamp: new Date().toISOString(),
        };
        setSamples((prev) => [entry, ...prev].slice(0, 50));
    }

    function requireEventOrAlert(): string | null {
        const e = eventName.trim();
        if (!e) {
            alert('Please select an event first.');
            return null;
        }
        return e;
    }

    function incrementLine() {
        if (!requireEventOrAlert()) return;
        setLineLength(prev => String((Number(prev) || 0) + 1));
    }

    function decrementLine() {
        if (!requireEventOrAlert()) return;
        setLineLength(prev => String(Math.max(0, (Number(prev) || 0) - 1)));
    }

    // Manual completion: records completion AND removes one from the queue
    function plusOne() {
        const e = requireEventOrAlert();
        if (!e) return;

        setCompletions(prev => [{ eventName: e, timestamp: new Date().toISOString() }, ...prev]);

        setLineLength(prev => String(Math.max(0, (Number(prev) || 0) - 1)));
    }

    const recent = useMemo(() => {
        const merged = [
            ...samples.map((s) => ({ ts: s.timestamp, text: `[Snapshot] ${s.eventName}: line=${s.lineLength}` })),
            ...completions.map((c) => ({ ts: c.timestamp, text: `[Completion] ${c.eventName}` })),
            // Optional: show SAE “new car seen” events in activity feed
            ...(useSAERunRate
                ? saeSeen.slice(0, 10).map((s) => ({ ts: s.firstSeenTs, text: `[SAE] New result: Car ${s.carNo}` }))
                : []),
        ]
            .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
            .slice(0, 12);

        return merged;
    }, [samples, completions, saeSeen, useSAERunRate]);

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
                        style={{
                            backgroundColor: '#161b22',
                            borderColor: '#30363d',
                        }}
                        dropDownContainerStyle={{
                            backgroundColor: '#11161d',
                            borderColor: '#30363d',
                        }}
                        listItemLabelStyle={{ color: '#238636' }}
                        textStyle={{ color: '#238636' }}
                        placeholder="Select event..."
                        placeholderStyle={{ color: '#c9d1d9' }}
                        ArrowDownIconComponent={() => (
                            <Text style={{ color: '#238636', fontSize: 14 }}>▼</Text>
                        )}
                        ArrowUpIconComponent={() => (
                            <Text style={{ color: '#238636', fontSize: 14 }}>▲</Text>
                        )}
                        theme="DARK"
                    />
                </View>

                {/* SAE toggle + status */}
                <View style={styles.row}>
                    <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Run rate source: </Text>
                        <Text style={[styles.toggleLabel, { color: useSAERunRate ? palette.success : palette.dim }]}>
                            {useSAERunRate ? 'SAE' : 'Manual'}
                        </Text>
                        <Switch
                            value={useSAERunRate}
                            onValueChange={setUseSAERunRate}
                            thumbColor={useSAERunRate ? palette.success : undefined}
                        />
                    </View>
                </View>
                <Text style={styles.statusText}>
                    {useSAERunRate ? saeStatus : 'Manual mode: use +1 Completion'}
                </Text>

                <View style={styles.row}>
                    <PrimaryButton title="+1 Car in Line" onPress={incrementLine} />
                    <PrimaryButton title="Remove from Queue" onPress={decrementLine} />
                    <PrimaryButton title="Snapshot Line Length" onPress={snapshot} />
                    <PrimaryButton title="+1 Completion" onPress={plusOne} />
                </View>


                <View style={styles.metrics}>
                    <Text style={styles.metric}>
                        <Text style={styles.metricKey}>Run rate ({sourceLabel}):</Text> {rate.toFixed(2)} / min
                    </Text>

                    <Text style={styles.metric}>
                        <Text style={styles.metricKey}>Current line of cars: </Text>
                        {Number(lineLength) || 0}
                    </Text>

                    <Text style={styles.metric}>
                        <Text style={styles.metricKey}>ETA:</Text> {eta && isFinite(eta) ? eta.toFixed(1) : '–'} minutes
                    </Text>

                    <Text style={styles.metric}>
                        <Text style={styles.metricKey}>Total completions:</Text> {count}
                    </Text>
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
                            <Text style={styles.itemText}>{new Date(item.ts).toLocaleString()} — {item.text}</Text>
                        </View>
                    )}
                />
            </Card>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.bg, padding: 12 },
    h2: { color: palette.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
    h3: { color: palette.text, fontSize: 15, fontWeight: '700', marginTop: 10 },
    label: { color: palette.dim, marginBottom: 6 },
    input: {
        backgroundColor: palette.inputBg,
        color: palette.text,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
    },
    inputInline: { width: 80, paddingVertical: 6, marginLeft: 6 },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginVertical: 4 },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
    metric: { color: palette.text },
    metricKey: { fontWeight: '700' },
    listItem: {
        backgroundColor: palette.listBg,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
    },
    itemText: { color: palette.text },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    toggleLabel: { color: palette.text, fontWeight: '700' },
    statusText: { color: palette.dim, marginTop: 4, marginBottom: 6 },
});
