import AppHeader from '@/components/ui/AppHeader';
import Card from '@/components/ui/Card';
import PrimaryButton from '@/components/ui/PrimaryButton';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { useOnline } from '@/offline/OnlineProvider';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';


const palette = {
    bg: '#0b0b0c',
    text: '#ffffff',
    dim: '#c9d1d9',
    inputBg: '#161b22',
    border: '#30363d',
    listBg: '#11161d',
    success: '#238636',
    danger: '#b91c1c',
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
const SAE_PROXY_BASE =
    (typeof process !== 'undefined' ? (process as any).env?.EXPO_PUBLIC_SAE_PROXY_BASE : undefined) as
    | string
    | undefined;
const SAE_FRESH_WINDOW_MS = 60 * 1000;

const dropdownListMode = 'SCROLLVIEW';

/**
 * Parses HTML content to extract car numbers that have valid results.
 *
 * @param html - The HTML string to parse. HTML tags are stripped and whitespace is normalized.
 * @returns An array of unique car numbers (as strings) that have valid results with positive time values.
 *
 * @remarks
 * The function searches for patterns matching: number, car number, optional text, "OK", and a positive time value.
 * Only car numbers with finite and positive time values are included in the result.
 * Results are deduplicated using a Set.
 *
 * @example
 * const html = '<div>123 456 Race OK 12.5</div>';
 * const cars = parseCarsWithResults(html);
 * // Returns: ['456']
 */
function parseCarsWithResults(html: string): string[] {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
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

/**
 * Parses the "Last Data Update" timestamp from HTML content.
 *
 * Extracts and converts a date-time string in the format "MM/DD/YYYY HH:MM:SS AM/PM"
 * from the provided HTML, removing all tags and normalizing whitespace.
 *
 * @param html - The HTML string to parse for the last data update timestamp
 * @returns An object containing the timestamp in milliseconds and the raw formatted string,
 *          or null if the timestamp pattern is not found or parsing fails
 * @returns {number} ms - Unix timestamp in milliseconds (local time)
 * @returns {string} raw - The original formatted timestamp string (e.g., "12/25/2023 03:45:30 PM")
 *
 * @example
 * const result = parseLastDataUpdate('<p>Last Data Update: 12/25/2023 03:45:30 PM</p>');
 * // Returns: { ms: 1703505930000, raw: "12/25/2023 03:45:30 PM" }
 */
function parseLastDataUpdate(html: string): { ms: number; raw: string } | null {
    const text = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const re =
        /Last\s*Data\s*Update\s*:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})\s+([0-9]{1,2}:[0-9]{2}:[0-9]{2})\s*(AM|PM)/i;

    const m = text.match(re);
    if (!m) return null;

    const datePart = m[1]; // MM/DD/YYYY
    const timePart = m[2]; // HH:MM:SS
    const ampm = m[3].toUpperCase(); // AM/PM

    const [mmStr, ddStr, yyyyStr] = datePart.split('/');
    const [hhStr, minStr, secStr] = timePart.split(':');

    const mm = Number(mmStr);
    const dd = Number(ddStr);
    const yyyy = Number(yyyyStr);
    let hh = Number(hhStr);
    const min = Number(minStr);
    const sec = Number(secStr);

    if (![mm, dd, yyyy, hh, min, sec].every(Number.isFinite)) return null;

    // 12h -> 24h
    if (ampm === 'PM' && hh !== 12) hh += 12;
    if (ampm === 'AM' && hh === 12) hh = 0;

    const d = new Date(yyyy, mm - 1, dd, hh, min, sec); // local time
    const ms = d.getTime();
    if (!Number.isFinite(ms)) return null;

    return { ms, raw: `${datePart} ${timePart} ${ampm}` };
}

/**
 * Determines whether a recently seen car has been observed within the freshness window.
 * @param seen - Array of SAESeen objects to check
 * @param nowMs - Current timestamp in milliseconds
 * @returns True if any car in the seen array was first observed within the freshness window, false otherwise
 */
function hasRecentNewCarSeen(seen: SAESeen[], nowMs: number) {
    return seen.some((s) => {
        const t = new Date(s.firstSeenTs).getTime();
        return Number.isFinite(t) && nowMs - t <= SAE_FRESH_WINDOW_MS;
    });
}

/**
 * Fetches the leaderboard HTML content for a given event code.
 *
 * @param eventCode - The event code to fetch the leaderboard for.
 * @returns A promise that resolves to the HTML content of the leaderboard.
 * @throws {Error} If the fetch fails and no fallback URL is available, or if both primary and fallback URLs fail.
 *
 * @remarks
 * This function attempts to fetch leaderboard data with platform-specific URL preference:
 * - **Web**: Prefers proxy URL (to avoid CORS issues), falls back to direct URL
 * - **Native**: Prefers direct URL, falls back to proxy URL if available
 *
 * The fetch is configured with `cache: 'no-store'` to ensure fresh data is retrieved.
 */
async function fetchLeaderboardHtml(eventCode: string): Promise<string> {
    const directUrl = `${SAE_BASE}${encodeURIComponent(eventCode)}`;
    const proxyUrl = SAE_PROXY_BASE ? `${SAE_PROXY_BASE}${encodeURIComponent(eventCode)}` : undefined;

    // Web: prefer proxy (CORS). Native: prefer direct (usually works).
    const primary = Platform.OS === 'web' ? (proxyUrl ?? directUrl) : directUrl;
    const fallback = Platform.OS === 'web' ? (proxyUrl ? directUrl : undefined) : proxyUrl;

    async function tryFetch(url: string) {
        const res = await fetch(url, { cache: 'no-store' as any });
        if (!res.ok) throw new Error(`SAE fetch failed: ${res.status}`);
        return await res.text();
    }

    try {
        return await tryFetch(primary);
    } catch (e) {
        if (fallback) return await tryFetch(fallback);
        throw e;
    }
}

/**
 * Updates the list of seen cars by adding new cars and maintaining a maximum history.
 * @param existing - The existing array of seen cars with their first seen timestamps
 * @param carsNow - The array of car numbers currently detected
 * @param nowIso - The current timestamp in ISO format
 * @returns A new array of seen cars with newly detected cars prepended, limited to 800 entries
 */
function updateSeenCars(existing: SAESeen[], carsNow: string[], nowIso: string) {
    const seenSet = new Set(existing.map((x) => x.carNo));
    const additions: SAESeen[] = [];

    for (const carNo of carsNow) {
        if (!seenSet.has(carNo)) {
            additions.push({ carNo, firstSeenTs: nowIso });
            seenSet.add(carNo);
        }
    }

    return [...additions, ...existing].slice(0, 800);
}

/**
 * DynamicTab Component
 *
 * A comprehensive run-rate tracking interface for monitoring queue progression and completion rates.
 * Supports dual modes: SAE (Society of Automotive Engineers) leaderboard-based tracking and manual queue management.
 *
 * @component
 *
 * @returns {JSX.Element} The rendered dynamic tracking tab with event selection, queue controls, and metrics.
 *
 * @remarks
 * - **SAE Mode**: Automatically polls SAE leaderboard for selected event, tracking new car results and calculating run rates based on actual submissions.
 * - **Manual Mode**: Allows manual queue input with completion tracking to derive run rates and ETAs.
 * - **Dual State Management**: Maintains separate state for SAE ("seen" cars, last update times) and manual mode (start timestamp).
 * - **Real-time Updates**: Uses a 1-second ticker to smoothly update elapsed time metrics.
 * - **Event Isolation**: Resets all tracking state when event selection changes to prevent metric contamination.
 * - **Freshness Heuristics**: Employs dual validation (timestamp-based and fallback) to determine data freshness.
 * - **Activity Log**: Displays recent snapshots, completions, and SAE results in reverse chronological order.
 *
 * @example
 * ```tsx
 * <DynamicTab />
 * ```
 *
 * @see {@link SAE_EVENT_CODE} - Event code mapping for SAE leaderboard URLs
 * @see {@link SAE_FRESH_WINDOW_MS} - Freshness window for SAE data validation
 * @see {@link LineSample} - Queue snapshot data structure
 * @see {@link Completion} - Completion record structure
 * @see {@link SAESeen} - SAE car result tracking structure
 */
export default function DynamicTab() {
    const isOnline = useOnline();

    const [eventName, setEventName] = useState('');
    const [lineLength, setLineLength] = useState('0');
    const [samples, setSamples] = useState<LineSample[]>([]);
    const [completions, setCompletions] = useState<Completion[]>([]);

    // SAE run-rate
    const [useSAERunRate, setUseSAERunRate] = useState(true);
    const [saeSeen, setSaeSeen] = useState<SAESeen[]>([]);
    const [saeStatus, setSaeStatus] = useState<string>('SAE idle');

    const [saeLastUpdateMs, setSaeLastUpdateMs] = useState<number | null>(null);
    const [saeLastUpdateRaw, setSaeLastUpdateRaw] = useState<string | null>(null);

    // Manual run-rate stability
    const [nowMs, setNowMs] = useState(() => Date.now());
    const [manualStartTs, setManualStartTs] = useState<string | null>(null);

    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([
        { label: 'Acceleration', value: 'Acceleration' },
        { label: 'Maneuverability', value: 'Maneuverability' },
        { label: 'Suspension', value: 'Suspension' },
    ]);

    // Tick so manual/SAE rates update smoothly
    useEffect(() => {
        const id = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // When event changes, reset SAE “seen”, lastUpdate, and manual start (avoids mixing)
    useEffect(() => {
        setSaeSeen([]);
        setSaeLastUpdateMs(null);
        setSaeLastUpdateRaw(null);
        setManualStartTs(null);
    }, [eventName]);

    // Poll SAE leaderboard when enabled + online + event selected
    useEffect(() => {
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
                setSaeStatus('Fetching SAE…');

                const html = await fetchLeaderboardHtml(code);
                if (cancelled) return;

                const carsNow = parseCarsWithResults(html);

                const last = parseLastDataUpdate(html);
                const now = Date.now();

                if (last) {
                    setSaeLastUpdateMs(last.ms);
                    setSaeLastUpdateRaw(last.raw);
                } else {
                    setSaeLastUpdateMs(null);
                    setSaeLastUpdateRaw(null);
                }

                const nowIso = new Date().toISOString();

                setSaeSeen((prev) => {
                    const updatedSeen = updateSeenCars(prev, carsNow, nowIso);

                    const freshByTimestamp =
                        last && now - last.ms >= 0 && now - last.ms <= SAE_FRESH_WINDOW_MS;

                    const freshByFallback = !last && hasRecentNewCarSeen(updatedSeen, now);

                    const fresh = !!freshByTimestamp || !!freshByFallback;

                    if (last) {
                        setSaeStatus(
                            fresh
                                ? `SAE OK — site updated ${Math.round((now - last.ms) / 1000)}s ago (Last Data Update: ${last.raw})`
                                : `SAE stale — site updated ${Math.round((now - last.ms) / 1000)}s ago (Last Data Update: ${last.raw})`
                        );
                    } else {
                        setSaeStatus(
                            fresh
                                ? `SAE OK — (timestamp not found; using fallback)`
                                : `SAE stale — (timestamp not found; using fallback)`
                        );
                    }

                    return fresh ? updatedSeen : prev;
                });
            } catch {
                const msg =
                    Platform.OS === 'web' && !SAE_PROXY_BASE
                        ? 'Web can’t pull SAE directly (CORS). Set EXPO_PUBLIC_SAE_PROXY_BASE to enable web SAE pulls.'
                        : 'SAE fetch failed (network/site). Manual still works.';
                setSaeStatus(msg);
            }
        };

        tick();
        const id = setInterval(tick, 20000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [eventName, isOnline, useSAERunRate]);

    function requireEventOrAlert(): string | null {
        const e = eventName.trim();
        if (!e) {
            Alert.alert('Event required', 'Please select an event first.');
            return null;
        }
        return e;
    }

    function incrementLine() {
        if (!requireEventOrAlert()) return;
        setLineLength((prev) => String((Number(prev) || 0) + 1));
    }

    function decrementLine() {
        if (!requireEventOrAlert()) return;
        setLineLength((prev) => String(Math.max(0, (Number(prev) || 0) - 1)));
    }

    // Manual completion: records completion AND removes one from queue
    function plusOne() {
        const e = requireEventOrAlert();
        if (!e) return;

        const ts = new Date().toISOString();
        setCompletions((prev) => [{ eventName: e, timestamp: ts }, ...prev]);

        // Start manual session timing on first completion for this event
        setManualStartTs((prev) => prev ?? ts);

        // completion removes from queue
        setLineLength((prev) => String(Math.max(0, (Number(prev) || 0) - 1)));
    }

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

    function csvEscape(value: unknown) {
        const s = String(value ?? '');
        // Escape quotes and wrap if needed
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
    }

    function buildLineSamplesCsv(rows: LineSample[]) {
        const header = ['eventName', 'timestamp', 'lineLength', 'runRate', 'etaMinutes'];
        const lines = [
            header.join(','),
            ...rows.map((r) =>
                [
                    csvEscape(r.eventName),
                    csvEscape(r.timestamp),
                    csvEscape(r.lineLength),
                    csvEscape(r.runRate),
                    csvEscape(r.etaMinutes ?? ''),
                ].join(',')
            ),
        ];
        return lines.join('\r\n') + '\r\n';
    }

    async function exportLineSamplesCsv() {
        if (samples.length === 0) {
            Alert.alert('Nothing to export', 'Take at least one snapshot first.');
            return;
        }

        try {
            const csv = buildLineSamplesCsv(samples);

            // Web: trigger download via Blob
            if (Platform.OS === 'web') {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);

                const safeEvent = (eventName || 'Event').replace(/[^a-z0-9-_]+/gi, '_');
                const filename = `LineSamples_${safeEvent}_${Date.now()}.csv`;

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();

                URL.revokeObjectURL(url);
                return;
            }

            // Native: write file then share
            const safeEvent = (eventName || 'Event').replace(/[^a-z0-9-_]+/gi, '_');
            const filename = `LineSamples_${safeEvent}_${Date.now()}.csv`;
            const uri = `${FileSystem.cacheDirectory}${filename}`;

            await FileSystem.writeAsStringAsync(uri, csv, {
                encoding: FileSystem.EncodingType.UTF8,
            });

            const canShare = await Sharing.isAvailableAsync();
            if (!canShare) {
                Alert.alert('Export created', `Saved to:\n${uri}`);
                return;
            }

            await Sharing.shareAsync(uri, {
                mimeType: 'text/csv',
                dialogTitle: 'Export Line Samples CSV',
                UTI: 'public.comma-separated-values-text',
            });
        } catch (err: any) {
            Alert.alert('Export failed', err?.message ?? 'Unknown error');
        }
    }


    const saeIsFresh = useMemo(() => {
        if (!useSAERunRate || !isOnline || !SAE_EVENT_CODE[eventName]) return false;
        if (saeLastUpdateMs == null) {
            // if we couldn't parse the site's timestamp, fall back to the “seen recently” heuristic
            return hasRecentNewCarSeen(saeSeen, nowMs);
        }
        const age = nowMs - saeLastUpdateMs;
        return age >= 0 && age <= SAE_FRESH_WINDOW_MS;
    }, [useSAERunRate, isOnline, eventName, saeLastUpdateMs, saeSeen, nowMs]);

    const { rate, count, sourceLabel } = useMemo(() => {
        // SAE mode
        if (useSAERunRate && isOnline && SAE_EVENT_CODE[eventName]) {
            if (!saeIsFresh) return { rate: 0, count: 0, sourceLabel: 'SAE (stale)' as const };

            if (saeSeen.length === 0) return { rate: 0, count: 0, sourceLabel: 'SAE' as const };

            const times = saeSeen
                .map((s) => new Date(s.firstSeenTs).getTime())
                .filter((t) => Number.isFinite(t))
                .sort((a, b) => a - b);

            if (times.length === 0) return { rate: 0, count: 0, sourceLabel: 'SAE' as const };

            const start = times[0];
            const elapsedMin = Math.max(0.25, (nowMs - start) / 60000); // min 15s
            return { rate: times.length / elapsedMin, count: times.length, sourceLabel: 'SAE' as const };
        }

        // Manual mode
        const e = eventName.trim() || 'Event';
        const eventCompletions = completions.filter((c) => c.eventName.trim() === e);
        const cCount = eventCompletions.length;

        if (cCount === 0 || !manualStartTs) {
            return { rate: 0, count: cCount, sourceLabel: 'Manual' as const };
        }

        const start = new Date(manualStartTs).getTime();
        const elapsedMin = Math.max(0.25, (nowMs - start) / 60000); // min 15s
        return { rate: cCount / elapsedMin, count: cCount, sourceLabel: 'Manual' as const };
    }, [useSAERunRate, isOnline, eventName, saeSeen, completions, manualStartTs, nowMs, saeIsFresh]);

    const eta = useMemo(() => {
        const ll = Number(lineLength) || 0;
        return rate > 0 ? ll / rate : undefined;
    }, [rate, lineLength]);

    const recent = useMemo(() => {
        const merged = [
            ...samples.map((s) => ({ ts: s.timestamp, text: `[Snapshot] ${s.eventName}: line=${s.lineLength}` })),
            ...completions.map((c) => ({ ts: c.timestamp, text: `[Completion] ${c.eventName}` })),
            ...(useSAERunRate
                ? saeSeen.slice(0, 10).map((s) => ({ ts: s.firstSeenTs, text: `[SAE] New result: Car ${s.carNo}` }))
                : []),
        ]
            .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
            .slice(0, 12);

        return merged;
    }, [samples, completions, saeSeen, useSAERunRate]);

    const currentLine = Number(lineLength) || 0;

    const manualCompletionsForEvent = useMemo(() => {
        const e = eventName.trim() || 'Event';
        return completions.filter((c) => c.eventName.trim() === e);
    }, [completions, eventName]);

    const manualCompletionCount = manualCompletionsForEvent.length;

    function undoCompletion() {
        const e = requireEventOrAlert();
        if (!e) return;

        setCompletions((prev) => {
            const idx = prev.findIndex((c) => c.eventName.trim() === e);
            if (idx < 0) return prev;

            const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];

            // Recompute manual session start for this event (oldest completion timestamp).
            const remainingForEvent = next.filter((c) => c.eventName.trim() === e);
            if (remainingForEvent.length === 0) {
                setManualStartTs(null);
            } else {
                const oldest = remainingForEvent
                    .map((c) => new Date(c.timestamp).getTime())
                    .filter((t) => Number.isFinite(t))
                    .sort((a, b) => a - b)[0];
                setManualStartTs(new Date(oldest).toISOString());
            }

            return next;
        });

        // Undo should also return one car back into the queue.
        setLineLength((prev) => String((Number(prev) || 0) + 1));
    }

    return (
        <View style={styles.screen}>
            <AppHeader />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Context */}
                <Card>
                    <Text style={styles.sectionTitle}>Event</Text>

                    <View style={ styles.dropdownWrap}>
                        <DropDownPicker
                            open={open}
                            value={eventName}
                            items={items}
                            setOpen={setOpen}
                            setValue={(cb) => setEventName(cb(eventName))}
                            setItems={setItems}
                            style={{ backgroundColor: palette.inputBg, borderColor: palette.border }}
                            dropDownContainerStyle={{ backgroundColor: palette.listBg, borderColor: palette.border }}
                            listItemLabelStyle={{ color: palette.success }}
                            textStyle={{ color: palette.success }}
                            placeholder="Select event..."
                            placeholderStyle={{ color: palette.dim }}
                            ArrowDownIconComponent={() => <Text style={{ color: palette.success, fontSize: 14 }}>▼</Text>}
                            ArrowUpIconComponent={() => <Text style={{ color: palette.success, fontSize: 14 }}>▲</Text>}
                            theme="DARK"
                            listMode={dropdownListMode as any}
                            dropDownDirection="BOTTOM"
                            maxHeight={220}
                            closeAfterSelecting={true}
                            scrollViewProps={{ nestedScrollEnabled: true }}
                            zIndex={3000}
                            zIndexInverse={1000}
                        />
                    </View>

                    <View style={styles.contextRow}>
                        <Text style={styles.contextLabel}>SAE / Manual</Text>

                        <View style={styles.segment}>
                            <Pressable
                                onPress={() => setUseSAERunRate(true)}
                                style={({ pressed }) => [
                                    styles.segmentBtn,
                                    useSAERunRate && styles.segmentBtnActive,
                                    pressed && styles.segmentBtnPressed,
                                ]}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityState={{ selected: useSAERunRate }}
                                accessibilityLabel="Use SAE mode"
                            >
                                <Text style={[styles.segmentText, useSAERunRate && styles.segmentTextActive]}>SAE</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => setUseSAERunRate(false)}
                                style={({ pressed }) => [
                                    styles.segmentBtn,
                                    !useSAERunRate && styles.segmentBtnActive,
                                    pressed && styles.segmentBtnPressed,
                                ]}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityState={{ selected: !useSAERunRate }}
                                accessibilityLabel="Use Manual mode"
                            >
                                <Text style={[styles.segmentText, !useSAERunRate && styles.segmentTextActive]}>Manual</Text>
                            </Pressable>
                        </View>
                    </View>


                    <Text style={styles.statusText}>
                        {useSAERunRate ? saeStatus : 'Manual mode: use completion controls'}
                    </Text>
                    {useSAERunRate && !!saeLastUpdateRaw && (
                        <Text style={[styles.statusText, { marginTop: 2 }]}>
                            Last Data Update (site): {saeLastUpdateRaw}
                        </Text>
                    )}
                </Card>

                {/* Operations */}
                <Card>
                    <View style={styles.twoColHeader}>
                        <Text style={styles.colTitle}>Queue</Text>
                        <Text style={styles.colTitle}>Completions</Text>
                    </View>

                    <View style={styles.twoCol}>
                        {/* Queue */}
                        <View style={styles.col}>
                            <RoundButton label="+" variant="primary" onPress={incrementLine} />
                            <View style={styles.valuePill}>
                                <Text style={styles.valueLabel}>Cars in line</Text>
                                <Text style={styles.valueNumber}>{currentLine}</Text>
                            </View>
                            <RoundButton label="−" variant="danger" onPress={decrementLine} />
                        </View>

                        {/* Completions */}
                        <View style={styles.col}>
                            <RoundButton
                                label="+"
                                variant={useSAERunRate ? 'disabled' : 'primary'}
                                onPress={useSAERunRate ? undefined : plusOne}
                            />
                            <View style={styles.valuePill}>
                                <Text style={styles.valueLabel}>Manual total</Text>
                                <Text style={styles.valueNumber}>{manualCompletionCount}</Text>
                            </View>
                            <RoundButton
                                label="−"
                                variant={useSAERunRate ? 'disabled' : 'danger'}
                                onPress={useSAERunRate ? undefined : undoCompletion}
                            />
                        </View>
                    </View>

                    {useSAERunRate && (
                        <Text style={styles.helperText}>
                            SAE rate is derived from leaderboard updates.
                        </Text>
                    )}
                </Card>

                {/* Metrics */}
                <Card>
                    <Text style={styles.sectionTitle}>Metrics</Text>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricKey}>Run Rate ({sourceLabel})</Text>
                        <Text style={styles.metricVal}>{rate.toFixed(2)} cars / min</Text>
                    </View>
                    <View style={styles.metricRow}>
                        <Text style={styles.metricKey}>ETA</Text>
                        <Text style={styles.metricVal}>{eta && isFinite(eta) ? eta.toFixed(1) : '–'} minutes</Text>
                    </View>
                    <View style={[styles.metricRow, { marginBottom: 0 }]}>
                        <Text style={styles.metricKey}>Total Completions ({sourceLabel})</Text>
                        <Text style={styles.metricVal}>{count}</Text>
                    </View>
                </Card>

                {/* Utilities */}
                <Card>
                    <Text style={styles.sectionTitle}>Utilities</Text>
                    <PrimaryButton title="Snapshot Line Length" onPress={snapshot} style={{ width: '100%' }} />
                    <View style={{ height: 10 }} />
                    <PrimaryButton title="Export Line Samples CSV" onPress={exportLineSamplesCsv} style={{ width: '100%' }} />
                </Card>

                {/* Recent */}
                <Card>
                    <Text style={styles.sectionTitle}>Recent Activity</Text>
                    {recent.length === 0 ? (
                        <Text style={styles.emptyText}>No activity yet.</Text>
                    ) : (
                        <View style={{ gap: 8 }}>
                            {recent.map((item, idx) => (
                                <View key={item.ts + idx} style={styles.listItem}>
                                    <Text style={styles.itemText}>
                                        {new Date(item.ts).toLocaleString()} — {item.text}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </Card>
            </ScrollView>
        </View>
    );
}

function RoundButton({
    label,
    variant,
    onPress,
}: {
    label: string;
    variant: 'primary' | 'danger' | 'disabled';
    onPress?: () => void;
}) {
    const isDisabled = variant === 'disabled' || !onPress;
    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            style={({ pressed }) => [
                styles.roundBtn,
                variant === 'primary' && styles.roundBtnPrimary,
                variant === 'danger' && styles.roundBtnDanger,
                isDisabled && styles.roundBtnDisabled,
                pressed && !isDisabled && styles.roundBtnPressed,
            ]}
        >
            <Text style={styles.roundBtnText}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.bg, paddingHorizontal: 12, paddingTop: 12 },
    scrollContent: { paddingBottom: 24 },

    sectionTitle: { color: palette.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },

    contextRow: {
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
    },
    contextLabel: { color: palette.text, fontWeight: '800' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    togglePill: {
        color: palette.dim,
        fontWeight: '800',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.inputBg,
        overflow: 'hidden',
    },
    togglePillActive: {
        color: palette.text,
        borderColor: palette.success,
    },
    statusText: { color: palette.dim, marginTop: 8 },

    twoColHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    colTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
    twoCol: { flexDirection: 'row', gap: 14 },
    col: {
        flex: 1,
        alignItems: 'center',
        gap: 10,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    valuePill: {
        width: '100%',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.inputBg,
        alignItems: 'center',
        gap: 2,
    },
    valueLabel: { color: palette.dim, fontWeight: '700', fontSize: 12 },
    valueNumber: { color: palette.text, fontWeight: '900', fontSize: 22 },
    helperText: { color: palette.dim, marginTop: 10, lineHeight: 18 },

    metricRow: {
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.inputBg,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
    },
    metricKey: { color: palette.dim, fontWeight: '700' },
    metricVal: { color: palette.text, fontWeight: '900', fontSize: 16, marginTop: 4 },

    listItem: {
        backgroundColor: palette.listBg,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
    },
    itemText: { color: palette.text },

    emptyText: { color: palette.dim },

    roundBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.inputBg,
    },
    roundBtnPrimary: { borderColor: palette.success, backgroundColor: 'rgba(35, 134, 54, 0.25)' },
    roundBtnDanger: { borderColor: palette.danger, backgroundColor: 'rgba(185, 28, 28, 0.22)' },
    roundBtnDisabled: { opacity: 0.45 },
    roundBtnPressed: { transform: [{ scale: 0.98 }] },
    roundBtnText: { color: palette.text, fontWeight: '900', fontSize: 24, marginTop: -2 },
    segment: {
        flexDirection: 'row',
        padding: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.inputBg,
        gap: 6,
    },
    segmentBtn: {
        minWidth: 96,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentBtnActive: {
        borderColor: palette.success,
        backgroundColor: 'rgba(35, 134, 54, 0.22)',
    },
    segmentBtnPressed: {
        transform: [{ scale: 0.99 }],
    },
    segmentText: {
        color: palette.dim,
        fontWeight: '900',
        fontSize: 16,
    },
    segmentTextActive: {
        color: palette.text,
    },
    dropdownWrap: {
        zIndex: 3000,
        elevation: 30,
    },

});
