/**
 * Concurrent / batched translation helpers, ported from immersive-translate-code.
 *
 * Two modes:
 * 1. LLM batch: one request with [0]/[1]/... numbered lines, then parse
 * 2. Concurrent singles: Promise.all over a chunk (true HTTP concurrency)
 */

export const DEFAULT_BATCH_SIZE = 5;
export const DEFAULT_CONCURRENCY = 5;

/** Group consecutive line indices, then split into chunks of maxSize. */
export function groupConsecutive(nums: number[], maxSize: number = DEFAULT_BATCH_SIZE): number[][] {
    if (nums.length === 0) {
        return [];
    }

    const groups: number[][] = [];
    let current: number[] = [nums[0]];

    for (let i = 1; i < nums.length; i++) {
        if (nums[i] === nums[i - 1] + 1) {
            current.push(nums[i]);
        } else {
            groups.push(current);
            current = [nums[i]];
        }
    }
    groups.push(current);

    return groups.flatMap((group) =>
        Array.from({ length: Math.ceil(group.length / maxSize) }, (_, i) =>
            group.slice(i * maxSize, (i + 1) * maxSize)
        )
    );
}

/** Split an array into fixed-size chunks (for non-consecutive concurrent workers). */
export function chunkArray<T>(items: T[], size: number): T[][] {
    if (size <= 0) {
        return [items];
    }
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}

const NUMBERED_LINE = /^\[(\d+)\]\s*(.*)/;

/**
 * Parse LLM batch response of the form:
 *   [0] 译文A
 *   [1] 译文B
 * Returns null if fewer than half the expected lines were parsed.
 */
export function parseNumberedResult(text: string, expectedCount: number): string[] | null {
    const results = new Array<string>(expectedCount).fill('');

    for (const line of text.split('\n')) {
        const match = line.match(NUMBERED_LINE);
        if (!match) {
            continue;
        }
        const idx = parseInt(match[1], 10);
        if (idx >= 0 && idx < expectedCount) {
            results[idx] = match[2].trim();
        }
    }

    const filled = results.filter((r) => r.length > 0).length;
    return filled >= expectedCount * 0.5 ? results : null;
}

/** Build numbered multi-line payload for a single LLM batch call. */
export function buildNumberedPayload(texts: string[]): string {
    return texts.map((t, i) => `[${i}] ${t}`).join('\n');
}
