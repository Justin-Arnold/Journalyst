import { TFile } from 'obsidian';
import moment from 'moment';
import { BUILT_IN_PROMPT_LISTS } from './promptLibrary';

export type PromptSourceType = 'built-in' | 'custom' | 'file';
export type PromptSelectionMode = 'static' | 'random' | 'random-no-repeat';
export type PromptDeliveryMode = 'append-body' | 'callout' | 'template-variables';

export interface PromptSourceSelection {
    sourceType: PromptSourceType;
    selectedListId?: string;
    selectedFilePath?: string;
}

export interface PromptListDefinition {
    id: string;
    name: string;
    sourceType: PromptSourceType;
    prompts: string[];
}

export interface JournalPromptSettings {
    enabled: boolean;
    sourceType: PromptSourceType;
    selectedListId?: string;
    selectedFilePath?: string;
    selectionMode: PromptSelectionMode;
    deliveryMode: PromptDeliveryMode;
    staticPromptId?: string;
    weekdayOverrides: Record<string, string>;
    weekdaySourceOverrides: Record<string, PromptSourceSelection>;
}

export interface JournalPromptHistory {
    usedPromptIdsBySource: Record<string, string[]>;
    sourceKey?: string;
    usedPromptIds?: string[];
}

export interface PromptOption {
    id: string;
    title: string;
    text: string;
}

export interface ResolvedPromptList {
    sourceKey: string;
    list: PromptListDefinition;
    prompts: PromptOption[];
}

export interface ResolvedPrompt {
    prompt: PromptOption;
    list: PromptListDefinition;
    sourceKey: string;
    history?: JournalPromptHistory | null;
    deliveryMode: PromptDeliveryMode;
    warning?: string;
}

export interface ResolvePromptContext {
    customPromptLists: Record<string, PromptListDefinition>;
    getFileByPath: (path: string) => TFile | null;
    readFile: (file: TFile) => Promise<string>;
}

const DEFAULT_PROMPT_SETTINGS: JournalPromptSettings = {
    enabled: false,
    sourceType: 'built-in',
    selectionMode: 'random',
    deliveryMode: 'append-body',
    weekdayOverrides: {},
    weekdaySourceOverrides: {},
};

export function getBuiltInPromptLists() {
    return BUILT_IN_PROMPT_LISTS;
}

export function normalizeJournalPromptSettings(settings?: Partial<JournalPromptSettings> | null): JournalPromptSettings {
    const weekdaySourceOverrides = Object.fromEntries(
        Object.entries(settings?.weekdaySourceOverrides ?? {})
            .map(([day, source]) => [day, normalizePromptSourceSelection(source)] as const)
            .filter((entry): entry is [string, PromptSourceSelection] => (
                /^[0-6]$/.test(entry[0]) && !!entry[1]
            )),
    );

    return {
        ...DEFAULT_PROMPT_SETTINGS,
        ...settings,
        weekdayOverrides: settings?.weekdayOverrides ?? {},
        weekdaySourceOverrides,
    };
}

export function normalizeJournalPromptHistory(history?: Partial<JournalPromptHistory> | null): JournalPromptHistory {
    const usedPromptIdsBySource = Object.fromEntries(
        Object.entries(history?.usedPromptIdsBySource ?? {})
            .filter((entry): entry is [string, string[]] => (
                !!entry[0] && Array.isArray(entry[1])
            ))
            .map(([sourceKey, promptIds]) => [
                sourceKey,
                promptIds.filter((promptId): promptId is string => typeof promptId === 'string'),
            ]),
    );

    if (history?.sourceKey && Array.isArray(history.usedPromptIds) && !usedPromptIdsBySource[history.sourceKey]) {
        usedPromptIdsBySource[history.sourceKey] = history.usedPromptIds
            .filter((promptId): promptId is string => typeof promptId === 'string');
    }

    return { usedPromptIdsBySource };
}

export function normalizePromptSourceSelection(
    source?: Partial<PromptSourceSelection> | null,
): PromptSourceSelection | null {
    if (!source || !['built-in', 'custom', 'file'].includes(source.sourceType ?? '')) {
        return null;
    }

    if (source.sourceType === 'file') {
        return {
            sourceType: 'file',
            selectedFilePath: source.selectedFilePath,
        };
    }

    if (source.sourceType === 'built-in' || source.sourceType === 'custom') {
        return {
            sourceType: source.sourceType,
            selectedListId: source.selectedListId,
        };
    }

    return null;
}

export function getPromptSourceSelection(settings: JournalPromptSettings): PromptSourceSelection {
    return settings.sourceType === 'file'
        ? { sourceType: 'file', selectedFilePath: settings.selectedFilePath }
        : { sourceType: settings.sourceType, selectedListId: settings.selectedListId };
}

export function getPromptSourceKey(source: PromptSourceSelection) {
    return source.sourceType === 'file'
        ? `file:${source.selectedFilePath ?? ''}`
        : `${source.sourceType}:${source.selectedListId ?? ''}`;
}

export function createPromptBlock(
    resolvedPrompt: ResolvedPrompt | null,
    deliveryMode = resolvedPrompt?.deliveryMode ?? 'append-body',
) {
    if (!resolvedPrompt) {
        return '';
    }

    const titleLine = resolvedPrompt.prompt.title && resolvedPrompt.prompt.title !== resolvedPrompt.prompt.text
        ? `**${resolvedPrompt.prompt.title}**\n\n`
        : '';

    const body = `${titleLine}${resolvedPrompt.prompt.text}`;
    if (deliveryMode === 'callout') {
        const quotedBody = body
            .split('\n')
            .map(line => line ? `> ${line}` : '>')
            .join('\n');
        return `> [!question] Prompt\n${quotedBody}`;
    }

    return `## Prompt\n\n${body}`;
}

export function createPromptOutputPreview(resolvedPrompt: ResolvedPrompt | null) {
    if (!resolvedPrompt) {
        return '';
    }

    if (resolvedPrompt.deliveryMode === 'template-variables') {
        return [
            `prompt: ${resolvedPrompt.prompt.text}`,
            `promptTitle: ${resolvedPrompt.prompt.title}`,
        ].join('\n');
    }

    return createPromptBlock(resolvedPrompt, resolvedPrompt.deliveryMode);
}

export function getPromptTemplateContext(resolvedPrompt: ResolvedPrompt | null) {
    if (!resolvedPrompt) {
        return null;
    }

    return {
        prompt: resolvedPrompt.prompt.text,
        promptTitle: resolvedPrompt.prompt.title,
    };
}

export async function resolvePromptForJournal(
    settings: JournalPromptSettings,
    history: JournalPromptHistory | undefined,
    date: string,
    context: ResolvePromptContext,
): Promise<{ resolvedPrompt: ResolvedPrompt | null; error?: string | null; list?: ResolvedPromptList | null }> {
    const normalizedSettings = normalizeJournalPromptSettings(settings);

    if (!normalizedSettings.enabled) {
        return { resolvedPrompt: null, list: null };
    }

    const weekday = moment(date, 'YYYY-MM-DD', true).day().toString();
    const sourceOverride = normalizedSettings.selectionMode === 'static'
        ? null
        : normalizedSettings.weekdaySourceOverrides[weekday] ?? null;
    const source = sourceOverride ?? getPromptSourceSelection(normalizedSettings);
    const resolvedList = await resolvePromptListFromSource(source, context);
    if (!resolvedList) {
        return { resolvedPrompt: null, error: 'No prompts are available for this journal.', list: null };
    }

    if (resolvedList.prompts.length === 0) {
        return { resolvedPrompt: null, error: 'The selected prompt list is empty.', list: resolvedList };
    }

    const weekdayOverrideId = sourceOverride ? null : normalizedSettings.weekdayOverrides[weekday];
    if (weekdayOverrideId) {
        const currentListPrompt = resolvedList.prompts.find(prompt => prompt.id === weekdayOverrideId);
        const legacyPrompt = currentListPrompt
            ? { list: resolvedList, prompt: currentListPrompt }
            : await resolvePromptOptionById(weekdayOverrideId, context);
        if (legacyPrompt) {
            return {
                resolvedPrompt: {
                    prompt: legacyPrompt.prompt,
                    list: legacyPrompt.list.list,
                    sourceKey: legacyPrompt.list.sourceKey,
                    history: null,
                    deliveryMode: normalizedSettings.deliveryMode,
                },
                list: resolvedList,
            };
        }
    }

    if (normalizedSettings.selectionMode === 'static') {
        const staticPrompt = resolvedList.prompts.find(prompt => prompt.id === normalizedSettings.staticPromptId)
            ?? resolvedList.prompts[0];

        return {
            resolvedPrompt: {
                prompt: staticPrompt,
                list: resolvedList.list,
                sourceKey: resolvedList.sourceKey,
                history: null,
                deliveryMode: normalizedSettings.deliveryMode,
            },
            list: resolvedList,
        };
    }

    if (normalizedSettings.selectionMode === 'random') {
        const prompt = pickRandom(resolvedList.prompts);
        return {
            resolvedPrompt: {
                prompt,
                list: resolvedList.list,
                sourceKey: resolvedList.sourceKey,
                history: null,
                deliveryMode: normalizedSettings.deliveryMode,
            },
            list: resolvedList,
        };
    }

    const normalizedHistory = normalizeJournalPromptHistory(history);
    const usableHistory = normalizedHistory.usedPromptIdsBySource[resolvedList.sourceKey] ?? [];
    let availablePrompts = resolvedList.prompts.filter(prompt => !usableHistory.includes(prompt.id));
    let nextUsedPromptIds = [...usableHistory];

    if (availablePrompts.length === 0) {
        nextUsedPromptIds = [];
        availablePrompts = [...resolvedList.prompts];
    }

    const prompt = pickRandom(availablePrompts);
    nextUsedPromptIds.push(prompt.id);

    return {
        resolvedPrompt: {
            prompt,
            list: resolvedList.list,
            sourceKey: resolvedList.sourceKey,
            history: {
                usedPromptIdsBySource: {
                    ...normalizedHistory.usedPromptIdsBySource,
                    [resolvedList.sourceKey]: nextUsedPromptIds,
                },
            },
            deliveryMode: normalizedSettings.deliveryMode,
        },
        list: resolvedList,
    };
}

export async function resolvePromptList(
    settings: JournalPromptSettings,
    context: ResolvePromptContext,
): Promise<ResolvedPromptList | null> {
    const normalizedSettings = normalizeJournalPromptSettings(settings);
    return resolvePromptListFromSource(getPromptSourceSelection(normalizedSettings), context);
}

export async function resolvePromptPreview(
    settings: JournalPromptSettings,
    context: ResolvePromptContext,
): Promise<ResolvedPrompt | null> {
    const normalizedSettings = normalizeJournalPromptSettings(settings);
    if (!normalizedSettings.enabled) {
        return null;
    }

    const resolvedList = await resolvePromptList(normalizedSettings, context);
    const prompt = normalizedSettings.selectionMode === 'static'
        ? resolvedList?.prompts.find(option => option.id === normalizedSettings.staticPromptId)
            ?? resolvedList?.prompts[0]
        : resolvedList?.prompts[0];
    if (!resolvedList || !prompt) {
        return null;
    }

    return {
        prompt,
        list: resolvedList.list,
        sourceKey: resolvedList.sourceKey,
        history: null,
        deliveryMode: normalizedSettings.deliveryMode,
    };
}

export async function resolvePromptListFromSource(
    source: PromptSourceSelection,
    context: ResolvePromptContext,
): Promise<ResolvedPromptList | null> {

    if (source.sourceType === 'built-in') {
        const list = source.selectedListId
            ? BUILT_IN_PROMPT_LISTS[source.selectedListId]
            : Object.values(BUILT_IN_PROMPT_LISTS)[0];

        return list ? hydratePromptList(list, `built-in:${list.id}`) : null;
    }

    if (source.sourceType === 'custom') {
        const list = source.selectedListId
            ? context.customPromptLists[source.selectedListId]
            : Object.values(context.customPromptLists)[0];

        return list ? hydratePromptList(list, `custom:${list.id}`) : null;
    }

    const filePath = source.selectedFilePath;
    if (!filePath) {
        return null;
    }

    const file = context.getFileByPath(filePath);
    if (!(file instanceof TFile)) {
        return null;
    }

    const contents = await context.readFile(file);
    const prompts = parseMarkdownPromptList(contents);
    const list: PromptListDefinition = {
        id: file.path,
        name: file.basename,
        sourceType: 'file',
        prompts,
    };

    return hydratePromptList(list, `file:${file.path}`);
}

export async function resolvePromptOptionById(
    promptId: string,
    context: ResolvePromptContext,
): Promise<{ list: ResolvedPromptList; prompt: PromptOption } | null> {
    const source = getPromptSourceFromPromptId(promptId);
    if (!source) return null;
    const list = await resolvePromptListFromSource(source, context);
    const prompt = list?.prompts.find(option => option.id === promptId);
    return list && prompt ? { list, prompt } : null;
}

function getPromptSourceFromPromptId(promptId: string): PromptSourceSelection | null {
    if (promptId.startsWith('built-in:') || promptId.startsWith('custom:')) {
        const [sourceType, selectedListId] = promptId.split(':');
        return selectedListId
            ? { sourceType: sourceType as 'built-in' | 'custom', selectedListId }
            : null;
    }

    if (promptId.startsWith('file:')) {
        const withoutPrefix = promptId.slice('file:'.length);
        const slugSeparator = withoutPrefix.lastIndexOf(':');
        const indexSeparator = slugSeparator > 0
            ? withoutPrefix.lastIndexOf(':', slugSeparator - 1)
            : -1;
        const selectedFilePath = indexSeparator > 0
            ? withoutPrefix.slice(0, indexSeparator)
            : '';
        return selectedFilePath ? { sourceType: 'file', selectedFilePath } : null;
    }

    return null;
}

export function createCustomPromptListDefinition(id: string, name: string, rawPromptText: string): PromptListDefinition {
    const prompts = rawPromptText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    return {
        id,
        name: name.trim() || 'Untitled Prompt List',
        sourceType: 'custom',
        prompts,
    };
}

export function parseMarkdownPromptList(contents: string) {
    return contents
        .split('\n')
        .map(line => {
            const match = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+)\s*$/);
            return match?.[1]?.trim() ?? null;
        })
        .filter((line): line is string => !!line);
}

function hydratePromptList(list: PromptListDefinition, sourceKey: string): ResolvedPromptList {
    return {
        sourceKey,
        list,
        prompts: list.prompts.map((text, index) => ({
            id: createPromptId(sourceKey, index, text),
            title: buildPromptTitle(text),
            text,
        })),
    };
}

function buildPromptTitle(text: string) {
    return text.length > 64 ? text.slice(0, 61).trimEnd() + '...' : text;
}

function createPromptId(prefix: string, index: number, text: string) {
    const slug = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32);
    return `${prefix}:${index}:${slug || 'prompt'}`;
}

function pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}
