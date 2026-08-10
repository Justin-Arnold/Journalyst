import { type App, TFile } from 'obsidian';
import moment from 'moment';
import type { LookbackResult, ReviewLookbackPreview } from './types';

const EXCERPT_LENGTH = 180;

export async function loadReviewLookbackPreviews(
    app: App,
    lookbacks: LookbackResult[],
): Promise<ReviewLookbackPreview[]> {
    return Promise.all(lookbacks.map(async lookback => {
        const fallbackTitle = moment(lookback.targetDate, 'YYYY-MM-DD', true).format('MMMM D, YYYY');
        if (!lookback.entry) {
            return createPreview(lookback, fallbackTitle, null);
        }

        const file = app.vault.getFileByPath(lookback.entry.filePath);
        if (!(file instanceof TFile)) {
            return createPreview(lookback, fallbackTitle, null);
        }

        try {
            const contents = await app.vault.cachedRead(file);
            const cache = app.metadataCache.getFileCache(file);
            const frontmatterTitle = cache?.frontmatter?.title;
            const headingTitle = cache?.headings?.[0]?.heading;
            const title = typeof frontmatterTitle === 'string' && frontmatterTitle.trim()
                ? frontmatterTitle.trim()
                : headingTitle?.trim() || fallbackTitle;
            const excerpt = createExcerpt(removeLeadingFrontmatter(contents), title);
            return createPreview(lookback, title, excerpt);
        } catch {
            return createPreview(lookback, fallbackTitle, null);
        }
    }));
}

function createPreview(
    lookback: LookbackResult,
    title: string,
    excerpt: string | null,
): ReviewLookbackPreview {
    return {
        label: lookback.label,
        targetDate: lookback.targetDate,
        filePath: lookback.entry?.filePath ?? null,
        isComplete: lookback.entry?.isComplete ?? null,
        title,
        excerpt,
    };
}

function removeLeadingFrontmatter(contents: string) {
    const normalized = contents.replace(/\r\n?/g, '\n');
    return normalized.replace(/^---\n[\s\S]*?\n---(?:\n|$)/, '');
}

function createExcerpt(markdown: string, title: string) {
    let plainText = markdown
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/~~~[\s\S]*?~~~/g, ' ')
        .replace(/!\[\[.*?\]\]/g, ' ')
        .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^>\s?/gm, '')
        .replace(/^\s*(?:[-*+] |\d+\. )/gm, '')
        .replace(/\[(?: |x|X)\]\s*/g, '')
        .replace(/[*_~`]/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (plainText.toLocaleLowerCase().startsWith(title.toLocaleLowerCase())) {
        plainText = plainText.slice(title.length).trim();
    }

    if (!plainText) return null;
    if (plainText.length <= EXCERPT_LENGTH) return plainText;

    const candidate = plainText.slice(0, EXCERPT_LENGTH - 3);
    const lastSpace = candidate.lastIndexOf(' ');
    const truncated = lastSpace > EXCERPT_LENGTH / 2
        ? candidate.slice(0, lastSpace)
        : candidate;
    return `${truncated}...`;
}
