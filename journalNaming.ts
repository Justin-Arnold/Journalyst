import { TAbstractFile, TFile, TFolder, normalizePath } from 'obsidian';
import moment from 'moment';

export interface JournalDateSettings {
    noteDateFormat: string;
    noteDateFormatHistory: string[];
}

export interface JournalNoteMigrationItem {
    journalPath: string;
    currentPath: string;
    targetPath: string;
    date: string;
    hasConflict: boolean;
    conflictPath?: string;
}

const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

export function getSupportedJournalDateFormats(settings: JournalDateSettings) {
    return Array.from(new Set([
        settings.noteDateFormat,
        ...settings.noteDateFormatHistory,
        DEFAULT_DATE_FORMAT,
    ].filter(Boolean)));
}

export function formatJournalNoteBaseName(date: string, settings: JournalDateSettings) {
    return moment(date, 'YYYY-MM-DD', true).format(settings.noteDateFormat);
}

export function formatJournalNoteFileName(date: string, settings: JournalDateSettings) {
    return formatJournalNoteBaseName(date, settings) + '.md';
}

export function parseJournalDateFromFileName(fileName: string, settings: JournalDateSettings) {
    if (!fileName.endsWith('.md')) {
        return null;
    }

    const baseName = fileName.slice(0, -3);

    for (const format of getSupportedJournalDateFormats(settings)) {
        const parsed = moment(baseName, format, true);
        if (parsed.isValid()) {
            return parsed.format('YYYY-MM-DD');
        }
    }

    return null;
}

export function parseJournalDateFromFile(file: TAbstractFile, settings: JournalDateSettings) {
    if (!(file instanceof TFile)) {
        return null;
    }

    return parseJournalDateFromFileName(file.name, settings);
}

export function findJournalEntryFile(journal: TFolder, date: string, settings: JournalDateSettings) {
    const expectedFileName = formatJournalNoteFileName(date, settings);
    const exactMatch = journal.children.find(child => child instanceof TFile && child.name === expectedFileName);

    if (exactMatch instanceof TFile) {
        return exactMatch;
    }

    return journal.children.find((child): child is TFile => {
        return child instanceof TFile && parseJournalDateFromFile(child, settings) === date;
    }) ?? null;
}

export function buildJournalMigrationPlan(journals: TFolder[], settings: JournalDateSettings) {
    const migrationItems: JournalNoteMigrationItem[] = [];
    const targetPathMap = new Map<string, string>();

    journals.forEach(journal => {
        journal.children.forEach(child => {
            if (!(child instanceof TFile)) {
                return;
            }

            const parsedDate = parseJournalDateFromFile(child, settings);
            if (!parsedDate) {
                return;
            }

            const targetFileName = formatJournalNoteFileName(parsedDate, settings);
            const targetPath = normalizePath(journal.path + '/' + targetFileName);

            if (targetPath === child.path) {
                return;
            }

            migrationItems.push({
                journalPath: journal.path,
                currentPath: child.path,
                targetPath,
                date: parsedDate,
                hasConflict: false,
            });
        });
    });

    migrationItems.forEach(item => {
        const existingSource = targetPathMap.get(item.targetPath);

        if (existingSource && existingSource !== item.currentPath) {
            item.hasConflict = true;
            item.conflictPath = existingSource;
            return;
        }

        targetPathMap.set(item.targetPath, item.currentPath);
    });

    const existingPaths = new Set(
        journals.flatMap(journal =>
            journal.children
                .filter((child): child is TFile => child instanceof TFile)
                .map(file => file.path)
        )
    );

    migrationItems.forEach(item => {
        if (item.hasConflict) {
            return;
        }

        if (existingPaths.has(item.targetPath) && item.targetPath !== item.currentPath) {
            item.hasConflict = true;
            item.conflictPath = item.targetPath;
        }
    });

    return migrationItems;
}
