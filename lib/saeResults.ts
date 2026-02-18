export type SAESeen = { carNo: string; firstSeenTs: string };

const BASE = 'https://results.bajasae.net/Leaderboard.aspx?Event=';

/**
 * Parses HTML content to extract car numbers that have completed results.
 * 
 * @param html - The HTML string to parse, typically containing race results
 * @returns An array of car numbers (as strings) that have valid completion times
 * 
 * @example
 * ```ts
 * const html = '<html>1 43 School OK 3.928</html>';
 * const cars = parseCarsWithResults(html);
 * // returns ['43']
 * ```
 * 
 * @remarks
 * - Normalizes whitespace and strips HTML tags before parsing
 * - Matches results in format: position, car number, school/team, "OK" status, and time
 * - Only includes cars with finite, positive completion times
 * - Returns results as unique car numbers using a Set internally
 */
export function parseCarsWithResults(html: string): string[] {
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
 * Fetches and parses leaderboard cars for a given SAE event.
 * @param eventCode - The SAE event code to fetch results for
 * @param fetchUrl - Optional custom URL to fetch from. If not provided, uses the default BASE URL with encoded event code
 * @returns A promise that resolves to the parsed cars with their results
 * @throws {Error} Throws an error if the fetch request fails with a non-ok status
 */
export async function fetchLeaderboardCars(eventCode: string, fetchUrl?: string) {
    const url = fetchUrl ?? `${BASE}${encodeURIComponent(eventCode)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SAE fetch failed: ${res.status}`);
    const html = await res.text();
    return parseCarsWithResults(html);
}

/**
 * Updates the list of seen cars by adding newly encountered cars and maintaining a bounded history.
 * 
 * @param existing - The array of previously seen cars with their first seen timestamps
 * @param carsNow - The array of car numbers currently detected
 * @param nowIso - The current timestamp in ISO 8601 format
 * @returns An object containing the updated list of seen cars (limited to the most recent 500) and the count of newly added cars
 */
export function updateSeenCars(
    existing: SAESeen[],
    carsNow: string[],
    nowIso: string
): { updated: SAESeen[]; newlyAdded: number } {
    const seenSet = new Set(existing.map(x => x.carNo));
    let newlyAdded = 0;

    const additions: SAESeen[] = [];
    for (const carNo of carsNow) {
        if (!seenSet.has(carNo)) {
            additions.push({ carNo, firstSeenTs: nowIso });
            seenSet.add(carNo);
            newlyAdded++;
        }
    }

    // Keep a bounded history so storage doesn’t grow forever
    const updated = [...additions, ...existing].slice(0, 500);
    return { updated, newlyAdded };
}
