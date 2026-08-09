import {
    TFile,
    TFolder,
    parseYaml,
    stringifyYaml,
    type BasesConfigFile,
    type BasesConfigFileView,
    type BasesPropertyId,
    type BasesSortConfig,
} from 'obsidian';
import moment from 'moment';
import { type JournalCadenceConfig } from './cadence';
import { type JournalPromptSettings } from './prompts';
import { type SynthesisPeriodType } from './review/types';

export type JournalystEntryType = 'entry' | 'weekly-review' | 'monthly-reflection' | 'quarter-summary';
export type BasesGenerationTarget = 'entries' | 'reflections';
export type JournalBasesIntegrationStatus = 'off' | 'unavailable' | 'setup-needed' | 'partial' | 'ready';
export type JournalBaseResourceStatus = 'ready' | 'missing' | 'conflict';

export interface JournalBaseResource {
    target: BasesGenerationTarget;
    label: string;
    description: string;
    filePath: string;
    status: JournalBaseResourceStatus;
}

export interface JournalBasesManagedProperty {
    key: keyof JournalystNoteProperties;
    label: string;
}

export interface JournalBasesIntegrationModel {
    globalEnabled: boolean;
    corePluginAvailable: boolean;
    status: JournalBasesIntegrationStatus;
    resources: JournalBaseResource[];
    managedProperties: JournalBasesManagedProperty[];
    recognizedNoteCount: number;
    backfillCount: number;
}

export interface JournalystNoteProperties {
    journalyst_date?: string;
    journalyst_entry_type?: JournalystEntryType;
    journalyst_journal_name?: string;
    journalyst_journal_path?: string;
    journalyst_cadence_type?: JournalCadenceConfig['type'];
    journalyst_prompt_source?: string;
    journalyst_prompt_title?: string;
    journalyst_period_type?: SynthesisPeriodType;
    journalyst_period_start?: string;
    journalyst_period_end?: string;
}

export interface JournalNotePropertyBackfillItem {
    filePath: string;
    journalPath: string;
    journalName: string;
    entryType: JournalystEntryType;
    missingKeys: string[];
    changedKeys: string[];
    properties: JournalystNoteProperties;
}

export interface JournalystPropertyContext {
    cadence: JournalCadenceConfig;
    date?: string;
    entryType: JournalystEntryType;
    journalName: string;
    journalPath: string;
    periodEnd?: string;
    periodStart?: string;
    periodType?: SynthesisPeriodType;
    promptSettings?: JournalPromptSettings | null;
    promptSource?: string | null;
    promptTitle?: string | null;
}

export interface ParsedJournalystNoteKind {
    date?: string;
    entryType: JournalystEntryType;
    periodEnd?: string;
    periodStart?: string;
    periodType?: SynthesisPeriodType;
}

type JournalystBaseView = Omit<BasesConfigFileView, 'groupBy' | 'order'> & {
    groupBy?: {
        property: BasesPropertyId;
        direction: 'ASC' | 'DESC';
    };
    order?: BasesPropertyId[];
    sort?: BasesSortConfig[];
    limit?: number;
};

type JournalystBaseConfig = Omit<BasesConfigFile, 'views'> & {
    views: JournalystBaseView[];
};

const ENTRY_BASE_FILE_NAME = 'journal-entries.base';
const REFLECTION_BASE_FILE_NAME = 'journal-reflections.base';

export const JOURNALYST_BASE_MANAGED_PROPERTIES: JournalBasesManagedProperty[] = [
    { key: 'journalyst_date', label: 'Date' },
    { key: 'journalyst_entry_type', label: 'Entry type' },
    { key: 'journalyst_journal_name', label: 'Journal' },
    { key: 'journalyst_journal_path', label: 'Journal path' },
    { key: 'journalyst_cadence_type', label: 'Cadence' },
    { key: 'journalyst_prompt_source', label: 'Prompt source' },
    { key: 'journalyst_prompt_title', label: 'Prompt' },
    { key: 'journalyst_period_type', label: 'Review period' },
    { key: 'journalyst_period_start', label: 'Period start' },
    { key: 'journalyst_period_end', label: 'Period end' },
];

export function getJournalystBaseFileName(target: BasesGenerationTarget) {
    return target === 'entries' ? ENTRY_BASE_FILE_NAME : REFLECTION_BASE_FILE_NAME;
}

export function buildJournalystNoteProperties(context: JournalystPropertyContext): JournalystNoteProperties {
    const properties: JournalystNoteProperties = {
        journalyst_entry_type: context.entryType,
        journalyst_journal_name: context.journalName,
        journalyst_journal_path: context.journalPath,
        journalyst_cadence_type: context.cadence.type,
    };

    if (context.date) {
        properties.journalyst_date = context.date;
    }

    if (context.promptSource) {
        properties.journalyst_prompt_source = context.promptSource;
    } else if (context.promptSettings?.enabled) {
        properties.journalyst_prompt_source = getPromptSourceLabel(context.promptSettings);
    }

    if (context.promptTitle) {
        properties.journalyst_prompt_title = context.promptTitle;
    }

    if (context.periodType) {
        properties.journalyst_period_type = context.periodType;
    }

    if (context.periodStart) {
        properties.journalyst_period_start = context.periodStart;
    }

    if (context.periodEnd) {
        properties.journalyst_period_end = context.periodEnd;
    }

    return properties;
}

export function upsertFrontmatterProperties(contents: string, properties: JournalystNoteProperties) {
    const frontmatterMatch = contents.match(/^---\n([\s\S]*?)\n---\n?/);
    const existingFrontmatter = frontmatterMatch ? safeParseFrontmatter(frontmatterMatch[1]) : {};
    const mergedFrontmatter = {
        ...existingFrontmatter,
        ...compactProperties(properties),
    };
    const nextFrontmatter = `---\n${stringifyYaml(mergedFrontmatter).trimEnd()}\n---\n`;
    const body = frontmatterMatch ? contents.slice(frontmatterMatch[0].length) : contents;
    return nextFrontmatter + body.replace(/^\n*/, '');
}

export function getFrontmatterPropertyDiff(currentFrontmatter: Record<string, unknown>, desiredProperties: JournalystNoteProperties) {
    const missingKeys: string[] = [];
    const changedKeys: string[] = [];

    Object.entries(compactProperties(desiredProperties)).forEach(([key, value]) => {
        if (!(key in currentFrontmatter)) {
            missingKeys.push(key);
            return;
        }

        if (String(currentFrontmatter[key]) !== String(value)) {
            changedKeys.push(key);
        }
    });

    return {
        missingKeys,
        changedKeys,
    };
}

export function parseJournalystNoteKind(file: TFile): ParsedJournalystNoteKind | null {
    const entryDate = parseEntryDateFromFileName(file.name);
    if (entryDate) {
        return {
            date: entryDate,
            entryType: 'entry',
        };
    }

    const weeklyMatch = file.name.match(/^weekly-review-(\d{4})-W(\d{2})\.md$/i);
    if (weeklyMatch) {
        const start = moment(`${weeklyMatch[1]}-W${weeklyMatch[2]}`, 'YYYY-[W]WW', true).startOf('week');
        if (start.isValid()) {
            return {
                entryType: 'weekly-review',
                periodType: 'weekly',
                periodStart: start.format('YYYY-MM-DD'),
                periodEnd: start.clone().endOf('week').format('YYYY-MM-DD'),
            };
        }
    }

    const monthMatch = file.name.match(/^monthly-reflection-(\d{4})-(\d{2})\.md$/i);
    if (monthMatch) {
        const start = moment(`${monthMatch[1]}-${monthMatch[2]}-01`, 'YYYY-MM-DD', true).startOf('month');
        if (start.isValid()) {
            return {
                entryType: 'monthly-reflection',
                periodType: 'monthly',
                periodStart: start.format('YYYY-MM-DD'),
                periodEnd: start.clone().endOf('month').format('YYYY-MM-DD'),
            };
        }
    }

    const quarterMatch = file.name.match(/^quarter-summary-(\d{4})-Q([1-4])\.md$/i);
    if (quarterMatch) {
        const quarterIndex = Number.parseInt(quarterMatch[2], 10) - 1;
        const start = moment(quarterMatch[1], 'YYYY', true).startOf('year').add(quarterIndex * 3, 'months').startOf('quarter');
        if (start.isValid()) {
            return {
                entryType: 'quarter-summary',
                periodType: 'quarterly',
                periodStart: start.format('YYYY-MM-DD'),
                periodEnd: start.clone().endOf('quarter').format('YYYY-MM-DD'),
            };
        }
    }

    return null;
}

export function buildEntryBaseContents(journal: TFolder) {
    const config: JournalystBaseConfig = {
        filters: {
            and: [
                `file.folder == ${JSON.stringify(journal.path)}`,
                'journalyst_entry_type == "entry"',
            ],
        },
        properties: {
            'file.name': { displayName: 'File' },
            journalyst_date: { displayName: 'Date' },
            journalyst_cadence_type: { displayName: 'Cadence' },
            journalyst_prompt_source: { displayName: 'Prompt Source' },
            journalyst_prompt_title: { displayName: 'Prompt' },
        },
        views: [
            {
                type: 'table',
                name: 'Recent entries',
                order: ['note.journalyst_date', 'file.name', 'note.journalyst_prompt_title'],
                sort: [{ property: 'note.journalyst_date', direction: 'DESC' }],
                limit: 30,
            },
            {
                type: 'table',
                name: 'All entries',
                order: [
                    'note.journalyst_date',
                    'file.name',
                    'note.journalyst_prompt_source',
                    'note.journalyst_prompt_title',
                ],
                sort: [{ property: 'note.journalyst_date', direction: 'DESC' }],
            },
            {
                type: 'table',
                name: 'By prompt source',
                groupBy: { property: 'note.journalyst_prompt_source', direction: 'ASC' },
                order: ['note.journalyst_date', 'file.name', 'note.journalyst_prompt_title'],
                sort: [{ property: 'note.journalyst_date', direction: 'DESC' }],
            },
            {
                type: 'table',
                name: 'By cadence',
                groupBy: { property: 'note.journalyst_cadence_type', direction: 'ASC' },
                order: ['note.journalyst_date', 'file.name'],
                sort: [{ property: 'note.journalyst_date', direction: 'DESC' }],
            },
        ],
    };

    return serializeBaseConfig(config);
}

export function buildReflectionBaseContents(journal: TFolder) {
    const periodEnd: BasesPropertyId = 'note.journalyst_period_end';
    const config: JournalystBaseConfig = {
        filters: {
            and: [
                `file.folder == ${JSON.stringify(journal.path)}`,
                {
                    or: [
                        'journalyst_entry_type == "weekly-review"',
                        'journalyst_entry_type == "monthly-reflection"',
                        'journalyst_entry_type == "quarter-summary"',
                    ],
                },
            ],
        },
        properties: {
            'file.name': { displayName: 'File' },
            journalyst_entry_type: { displayName: 'Reflection Type' },
            journalyst_period_type: { displayName: 'Period' },
            journalyst_period_start: { displayName: 'Period Start' },
            journalyst_period_end: { displayName: 'Period End' },
        },
        views: [
            {
                type: 'table',
                name: 'Recent reviews',
                order: [periodEnd, 'file.name', 'note.journalyst_entry_type'],
                sort: [{ property: periodEnd, direction: 'DESC' }],
                limit: 20,
            },
            buildReflectionView('Weekly', 'weekly-review', periodEnd),
            buildReflectionView('Monthly', 'monthly-reflection', periodEnd),
            buildReflectionView('Quarterly', 'quarter-summary', periodEnd),
        ],
    };

    return serializeBaseConfig(config);
}

function buildReflectionView(
    name: string,
    entryType: JournalystEntryType,
    periodEnd: BasesPropertyId,
): JournalystBaseView {
    return {
        type: 'table',
        name,
        filters: { and: [`journalyst_entry_type == ${JSON.stringify(entryType)}`] },
        order: [periodEnd, 'file.name'],
        sort: [{ property: periodEnd, direction: 'DESC' }],
    };
}

function serializeBaseConfig(config: JournalystBaseConfig) {
    return `${stringifyYaml(config).trimEnd()}\n`;
}

function getPromptSourceLabel(promptSettings: JournalPromptSettings) {
    if (promptSettings.sourceType === 'file') {
        return promptSettings.selectedFilePath ?? 'markdown-note';
    }

    return promptSettings.selectedListId ?? promptSettings.sourceType;
}

function compactProperties(properties: JournalystNoteProperties) {
    return Object.fromEntries(
        Object.entries(properties).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
}

function safeParseFrontmatter(frontmatter: string): Record<string, unknown> {
    try {
        const parsed = parseYaml(frontmatter);
        return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
        return {};
    }
}

function parseEntryDateFromFileName(fileName: string) {
    const match = fileName.match(/^(\d{4}-\d{2}-\d{2})\.md$/i);
    if (!match) {
        return null;
    }

    return match[1];
}
