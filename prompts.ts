import { TFile } from 'obsidian';
import moment from 'moment';
import { BUILT_IN_PROMPT_LISTS } from './promptLibrary';

export type PromptSourceType = 'built-in' | 'custom' | 'file';
export type PromptSelectionMode = 'static' | 'random' | 'random-no-repeat';
export type PromptDeliveryMode = 'append-body' | 'template-variables';

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
}

export interface JournalPromptHistory {
    sourceKey: string;
    usedPromptIds: string[];
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
};

export function getBuiltInPromptLists() {
    return BUILT_IN_PROMPT_LISTS;
}

export function normalizeJournalPromptSettings(settings?: Partial<JournalPromptSettings> | null): JournalPromptSettings {
    return {
        ...DEFAULT_PROMPT_SETTINGS,
        ...settings,
        weekdayOverrides: settings?.weekdayOverrides ?? {},
    };
}

export function createPromptBlock(resolvedPrompt: ResolvedPrompt | null) {
    if (!resolvedPrompt) {
        return '';
    }

    const titleLine = resolvedPrompt.prompt.title && resolvedPrompt.prompt.title !== resolvedPrompt.prompt.text
        ? `**${resolvedPrompt.prompt.title}**\n\n`
        : '';

    return `## Prompt\n\n${titleLine}${resolvedPrompt.prompt.text}`;
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

    const resolvedList = await resolvePromptList(normalizedSettings, context);
    if (!resolvedList) {
        return { resolvedPrompt: null, error: 'No prompts are available for this journal.', list: null };
    }

    if (resolvedList.prompts.length === 0) {
        return { resolvedPrompt: null, error: 'The selected prompt list is empty.', list: resolvedList };
    }

    const weekdayOverrideId = normalizedSettings.weekdayOverrides[moment(date, 'YYYY-MM-DD', true).day().toString()];
    if (weekdayOverrideId) {
        const overridePrompt = resolvedList.prompts.find(prompt => prompt.id === weekdayOverrideId);
        if (overridePrompt) {
            return {
                resolvedPrompt: {
                    prompt: overridePrompt,
                    list: resolvedList.list,
                    sourceKey: resolvedList.sourceKey,
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

    const usableHistory = history?.sourceKey === resolvedList.sourceKey ? history.usedPromptIds : [];
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
                sourceKey: resolvedList.sourceKey,
                usedPromptIds: nextUsedPromptIds,
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

    if (normalizedSettings.sourceType === 'built-in') {
        const list = normalizedSettings.selectedListId
            ? BUILT_IN_PROMPT_LISTS[normalizedSettings.selectedListId]
            : Object.values(BUILT_IN_PROMPT_LISTS)[0];

        return list ? hydratePromptList(list, `built-in:${list.id}`) : null;
    }

    if (normalizedSettings.sourceType === 'custom') {
        const list = normalizedSettings.selectedListId
            ? context.customPromptLists[normalizedSettings.selectedListId]
            : Object.values(context.customPromptLists)[0];

        return list ? hydratePromptList(list, `custom:${list.id}`) : null;
    }

    const filePath = normalizedSettings.selectedFilePath;
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
