import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export type LineSample = {
    eventName: string; timestamp: string; lineLength: number; windowMin: number;
    runRate: number; etaMinutes: number | null;
};
export type Completion = { eventName: string; timestamp: string };

function csvEscape(val: string | number | null | undefined) {
    const s = val ?? '';
    const str = String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function buildSamplesCSV(samples: LineSample[]) {
    const header = ['timestamp', 'eventName', 'lineLength', 'windowMin', 'runRate', 'etaMinutes'].join(',');
    const rows = samples.map(s => [
        csvEscape(s.timestamp),
        csvEscape(s.eventName),
        csvEscape(s.lineLength),
        csvEscape(s.windowMin),
        csvEscape(s.runRate),
        csvEscape(s.etaMinutes),
    ].join(','));
    return [header, ...rows].join('\n');
}

export function buildCompletionsCSV(completions: Completion[]) {
    const header = ['timestamp', 'eventName'].join(',');
    const rows = completions.map(c => [
        csvEscape(c.timestamp),
        csvEscape(c.eventName),
    ].join(','));
    return [header, ...rows].join('\n');
}

/**
 * Writes `contents` to a text file under the app sandbox.
 * - Uses `documentDirectory` when available (native).
 * - Falls back to `cacheDirectory` (e.g. on Web where documentDirectory can be null).
 * - Ensures the filename has no slashes.
 * Returns the absolute URI to the file.
 */
export async function writeTextFile(name: string, contents: string) {
    // sanitize filename (no path separators)
    const safeName = name.replace(/[\\/]/g, '_');

    // choose a safe base dir
    const baseDir =
        FileSystem.documentDirectory ??
        FileSystem.cacheDirectory; // never null on supported platforms

    if (!baseDir) {
        // Extremely unlikely in Expo, but keeps TS happy and avoids runtime crash.
        throw new Error('No writable base directory available for FileSystem.');
    }

    const uri = baseDir + safeName;

    // Encoding: use the enum in expo-file-system for correct typing
    await FileSystem.writeAsStringAsync(uri, contents, {
        encoding: FileSystem.EncodingType.UTF8,
    });

    return uri;
}

/**
 * Opens the platform share sheet if available (no-op on Web where not supported).
 */
export async function shareIfAvailable(uri: string) {
    try {
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri);
        }
    } catch (e) {
        // Sharing might not be supported on some environments — swallow gracefully.
        console.warn('Sharing failed or not available:', e);
    }
}
