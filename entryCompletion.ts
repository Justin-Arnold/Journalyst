const FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---(?:\n|$)/;

export function normalizeJournalEntryBody(contents: string) {
    const normalizedContents = contents.replace(/\r\n?/g, '\n');
    return normalizedContents.replace(FRONTMATTER_PATTERN, '').trim();
}

export async function hashJournalEntryBody(contents: string) {
    const body = normalizeJournalEntryBody(contents);
    const data = new TextEncoder().encode(body);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data);

    return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}
