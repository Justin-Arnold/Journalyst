import { App, Modal } from 'obsidian';
import {
    JOURNALYST_BASE_MANAGED_PROPERTIES,
    type BasesGenerationTarget,
    type JournalNotePropertyBackfillItem,
} from '../bases';

const PREVIEW_LIMIT = 50;
const propertyLabels = new Map<string, string>(
    JOURNALYST_BASE_MANAGED_PROPERTIES.map(property => [property.key, property.label]),
);

class ResetJournalBaseModal extends Modal {
    private settled = false;

    constructor(
        app: App,
        private readonly target: BasesGenerationTarget,
        private readonly resolve: (reset: boolean) => void,
    ) {
        super(app);
    }

    onOpen() {
        const label = this.target === 'entries' ? 'Journal entries' : 'Reviews and reflections';
        this.setTitle(`Reset ${label} Base?`);
        this.contentEl.createEl('p', {
            text: "This replaces the Base definition with Journalyst's starter views. Custom views, filters, sorting, and formulas in this Base will be lost. Your journal notes and their properties are not changed.",
        });

        const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
        const cancelButton = actions.createEl('button', { text: 'Keep customized Base' });
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', () => this.finish(false));

        const resetButton = actions.createEl('button', { text: 'Reset Base', cls: 'mod-warning' });
        resetButton.type = 'button';
        resetButton.addEventListener('click', () => this.finish(true));
        cancelButton.focus();
    }

    onClose() {
        this.contentEl.empty();
        if (!this.settled) {
            this.settled = true;
            this.resolve(false);
        }
    }

    private finish(reset: boolean) {
        if (this.settled) return;
        this.settled = true;
        this.resolve(reset);
        this.close();
    }
}

class BasesBackfillPreviewModal extends Modal {
    private settled = false;

    constructor(
        app: App,
        private readonly items: JournalNotePropertyBackfillItem[],
        private readonly resolve: (apply: boolean) => void,
    ) {
        super(app);
    }

    onOpen() {
        this.setTitle('Journal metadata preview');
        if (this.items.length === 0) {
            this.contentEl.createEl('p', {
                text: 'Every recognized note in this journal already has the current Journalyst metadata.',
            });
            const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
            const closeButton = actions.createEl('button', { text: 'Close', cls: 'mod-cta' });
            closeButton.type = 'button';
            closeButton.addEventListener('click', () => this.finish(false));
            closeButton.focus();
            return;
        }

        this.contentEl.createEl('p', {
            text: `${this.items.length} recognized note${this.items.length === 1 ? '' : 's'} need missing or updated Journalyst properties. Other frontmatter will be left alone.`,
        });

        const list = this.contentEl.createDiv({ cls: 'journalyst-bases-backfill-list' });
        this.items.slice(0, PREVIEW_LIMIT).forEach(item => {
            const row = list.createDiv({ cls: 'journalyst-bases-backfill-row' });
            row.createEl('code', { text: item.filePath });
            const changes = [
                item.missingKeys.length > 0
                    ? `Add ${item.missingKeys.map(key => propertyLabels.get(key) ?? key).join(', ')}`
                    : null,
                item.changedKeys.length > 0
                    ? `Update ${item.changedKeys.map(key => propertyLabels.get(key) ?? key).join(', ')}`
                    : null,
            ].filter((value): value is string => !!value);
            row.createEl('span', { text: changes.join(' | ') });
        });

        if (this.items.length > PREVIEW_LIMIT) {
            this.contentEl.createEl('p', {
                text: `Showing the first ${PREVIEW_LIMIT} affected notes.`,
                cls: 'setting-item-description',
            });
        }

        const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
        const cancelButton = actions.createEl('button', { text: 'Cancel' });
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', () => this.finish(false));

        const applyButton = actions.createEl('button', {
            text: `Update ${this.items.length} note${this.items.length === 1 ? '' : 's'}`,
            cls: 'mod-cta',
        });
        applyButton.type = 'button';
        applyButton.addEventListener('click', () => this.finish(true));
        cancelButton.focus();
    }

    onClose() {
        this.contentEl.empty();
        if (!this.settled) {
            this.settled = true;
            this.resolve(false);
        }
    }

    private finish(apply: boolean) {
        if (this.settled) return;
        this.settled = true;
        this.resolve(apply);
        this.close();
    }
}

export function confirmResetJournalBase(app: App, target: BasesGenerationTarget) {
    return new Promise<boolean>(resolve => {
        new ResetJournalBaseModal(app, target, resolve).open();
    });
}

export function previewJournalBasesBackfill(app: App, items: JournalNotePropertyBackfillItem[]) {
    return new Promise<boolean>(resolve => {
        new BasesBackfillPreviewModal(app, items, resolve).open();
    });
}
