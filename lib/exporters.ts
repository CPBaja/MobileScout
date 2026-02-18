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

/**
 * Builds a CSV string from an array of line samples.
 * @param samples - Array of line samples to convert to CSV format
 * @returns A CSV formatted string with header row and data rows, with proper escaping applied
 */
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

/**
 * Builds a CSV string from an array of completions.
 * @param completions - An array of Completion objects to convert to CSV format
 * @returns A CSV formatted string with header row and data rows
 */
export function buildCompletionsCSV(completions: Completion[]) {
    const header = ['timestamp', 'eventName'].join(',');
    const rows = completions.map(c => [
        csvEscape(c.timestamp),
        csvEscape(c.eventName),
    ].join(','));
    return [header, ...rows].join('\n');
}

/**
 * Writes text content to a file in the application's safe directory.
 * 
 * @param name - The desired filename. Path separators will be sanitized to underscores.
 * @param contents - The text content to write to the file.
 * @returns A promise that resolves to the URI of the created file.
 * @throws {Error} If no writable base directory is available on the device.
 * 
 * @example
 * const uri = await writeTextFile('export.txt', 'Hello, World!');
 */
export async function writeTextFile(name: string, contents: string) {
    const safeName = name.replace(/[\\/]/g, '_');

    const baseDir =
        FileSystem.documentDirectory ??
        FileSystem.cacheDirectory;

    if (!baseDir) {
        throw new Error('No writable base directory available for FileSystem.');
    }

    const uri = baseDir + safeName;

    await FileSystem.writeAsStringAsync(uri, contents, {
        encoding: FileSystem.EncodingType.UTF8,
    });

    return uri;
}

/**
 * Shares a file at the given URI if sharing is available on the device.
 * 
 * @param uri - The URI of the file to share.
 * @remarks
 * This function gracefully handles cases where sharing is not supported.
 * If sharing fails or is unavailable, a warning is logged to the console.
 */
export async function shareIfAvailable(uri: string) {
    try {
        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri);
        }
    } catch (e) {
        console.warn('Sharing failed or not available:', e);
    }
}
