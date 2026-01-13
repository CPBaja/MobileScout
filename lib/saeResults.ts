export type SAESeen = { carNo: string; firstSeenTs: string };

const BASE = 'https://results.bajasae.net/Leaderboard.aspx?Event=';

// Very lightweight parser that works even if the HTML changes a bit.
// It looks for patterns like " 43 ... OK 3.928 " (as visible on the page text) :contentReference[oaicite:4]{index=4}
export function parseCarsWithResults(html: string): string[] {
    // Normalize whitespace so regex works on “pretty printed” HTML too
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

    // Matches: "<pos> <carNo> <school/team...> OK <time>"
    // Example from page text: "1 43 ... OK 3.928" :contentReference[oaicite:5]{index=5}
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

export async function fetchLeaderboardCars(eventCode: string, fetchUrl?: string) {
    const url = fetchUrl ?? `${BASE}${encodeURIComponent(eventCode)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SAE fetch failed: ${res.status}`);
    const html = await res.text();
    return parseCarsWithResults(html);
}

/**
 * Update the "seen cars" list by adding any newly-completed cars with a timestamp.
 * Returns: updatedSeen, newlyAddedCount
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
