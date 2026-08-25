import { App, Modal, Setting } from 'obsidian';
import type { JournalNoteMigrationItem } from '../journalNaming';
import type { PromptLibraryListItem } from '../src/components/settings/types';

export interface PromptLibraryDraft {
    name: string;
    body: string;
}

class PromptLibraryModal extends Modal {
    private settled = false;

    constructor(
        app: App,
        private readonly initialValue: PromptLibraryDraft | null,
        private readonly resolve: (value: PromptLibraryDraft | null) => void,
    ) {
        super(app);
    }

    onOpen() {
        this.setTitle(this.initialValue ? 'Edit prompt library' : 'New prompt library');
        this.contentEl.empty();

        const form = this.contentEl.createEl('form', { cls: 'journalyst-prompt-library-form' });
        form.createEl('p', {
            text: 'Journalyst treats each non-empty line as one prompt.',
            cls: 'setting-item-description',
        });

        let nameInput!: HTMLInputElement;
        new Setting(form)
            .setName('Library name')
            .addText(text => {
                text.setPlaceholder('Morning reflections')
                    .setValue(this.initialValue?.name ?? '');
                text.inputEl.required = true;
                text.inputEl.autocomplete = 'off';
                nameInput = text.inputEl;
            });

        const editor = form.createDiv({ cls: 'journalyst-prompt-library-editor' });
        editor.createEl('label', {
            text: 'Prompts',
            attr: { for: 'journalyst-prompt-library-body' },
        });
        const textarea = editor.createEl('textarea', {
            attr: {
                id: 'journalyst-prompt-library-body',
                placeholder: 'Write one prompt per line',
                rows: '10',
            },
        });
        textarea.value = this.initialValue?.body ?? '';
        const promptCount = editor.createEl('span', { cls: 'setting-item-description' });
        const updatePromptCount = () => {
            const count = countPrompts(textarea.value);
            promptCount.setText(`${count} ${count === 1 ? 'prompt' : 'prompts'}`);
        };
        textarea.addEventListener('input', updatePromptCount);
        updatePromptCount();

        const errorEl = form.createDiv({ cls: 'journalyst-settings-modal-error' });
        errorEl.setAttr('role', 'alert');

        const actions = form.createDiv({ cls: 'modal-button-container' });
        const cancelButton = actions.createEl('button', { text: 'Cancel' });
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', () => this.finish(null));

        const saveButton = actions.createEl('button', {
            text: this.initialValue ? 'Save library' : 'Create library',
            cls: 'mod-cta',
        });
        saveButton.type = 'submit';

        form.addEventListener('submit', event => {
            event.preventDefault();
            const name = nameInput.value.trim();
            if (!name) {
                errorEl.setText('Enter a library name.');
                nameInput.focus();
                return;
            }

            this.finish({ name, body: textarea.value });
        });

        nameInput.focus();
    }

    onClose() {
        this.contentEl.empty();
        if (!this.settled) {
            this.settled = true;
            this.resolve(null);
        }
    }

    private finish(value: PromptLibraryDraft | null) {
        if (this.settled) return;
        this.settled = true;
        this.resolve(value);
        this.close();
    }
}

class DeletePromptLibraryModal extends Modal {
    private settled = false;

    constructor(
        app: App,
        private readonly library: PromptLibraryListItem,
        private readonly resolve: (confirmed: boolean) => void,
    ) {
        super(app);
    }

    onOpen() {
        this.setTitle(`Delete ${this.library.name}?`);
        this.contentEl.empty();

        const usageParts = [
            this.library.journalUsageCount > 0
                ? `${this.library.journalUsageCount} journal ${this.library.journalUsageCount === 1 ? 'assignment' : 'assignments'}`
                : null,
            this.library.weekdayOverrideCount > 0
                ? `${this.library.weekdayOverrideCount} weekday ${this.library.weekdayOverrideCount === 1 ? 'override' : 'overrides'}`
                : null,
        ].filter((value): value is string => !!value);

        this.contentEl.createEl('p', {
            text: usageParts.length > 0
                ? `This library is used by ${usageParts.join(' and ')}. Default assignments will be disabled and matching weekday overrides will be removed.`
                : 'This removes the custom library. Journal notes that already used its prompts will not be changed.',
        });

        const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
        const cancelButton = actions.createEl('button', { text: 'Keep library' });
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', () => this.finish(false));

        const deleteButton = actions.createEl('button', { text: 'Delete library', cls: 'mod-warning' });
        deleteButton.type = 'button';
        deleteButton.addEventListener('click', () => this.finish(true));
        cancelButton.focus();
    }

    onClose() {
        this.contentEl.empty();
        if (!this.settled) {
            this.settled = true;
            this.resolve(false);
        }
    }

    private finish(confirmed: boolean) {
        if (this.settled) return;
        this.settled = true;
        this.resolve(confirmed);
        this.close();
    }
}

class NoteMigrationPreviewModal extends Modal {
    private settled = false;

    constructor(
        app: App,
        private readonly format: string,
        private readonly items: JournalNoteMigrationItem[],
        private readonly resolve: (apply: boolean) => void,
    ) {
        super(app);
    }

    onOpen() {
        this.setTitle('Filename migration preview');
        this.contentEl.empty();

        const conflicts = this.items.filter(item => item.hasConflict);
        const safeItems = this.items.filter(item => !item.hasConflict);

        if (this.items.length === 0) {
            this.contentEl.createEl('p', {
                text: `Every recognized journal entry already matches ${this.format}.`,
            });
            this.renderCloseAction();
            return;
        }

        this.contentEl.createEl('p', {
            text: conflicts.length > 0
                ? `${this.items.length} notes would be renamed, but ${conflicts.length} ${conflicts.length === 1 ? 'conflict must' : 'conflicts must'} be resolved first.`
                : `${safeItems.length} ${safeItems.length === 1 ? 'note' : 'notes'} can be renamed to match ${this.format}.`,
        });

        const list = this.contentEl.createDiv({ cls: 'journalyst-settings-preview-list' });
        this.items.slice(0, 50).forEach(item => {
            const row = list.createDiv({
                cls: `journalyst-settings-preview-row${item.hasConflict ? ' is-conflict' : ''}`,
            });
            row.createEl('code', { text: item.currentPath });
            row.createEl('span', { text: '->', cls: 'journalyst-settings-preview-arrow' });
            row.createEl('code', { text: item.targetPath });
            if (item.hasConflict) {
                row.createEl('span', {
                    text: `Conflicts with ${item.conflictPath}`,
                    cls: 'journalyst-settings-preview-conflict',
                });
            }
        });

        if (this.items.length > 50) {
            this.contentEl.createEl('p', {
                text: `Showing the first 50 of ${this.items.length} rename candidates.`,
                cls: 'setting-item-description',
            });
        }

        const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
        const cancelButton = actions.createEl('button', { text: conflicts.length > 0 ? 'Close' : 'Cancel' });
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', () => this.finish(false));

        if (conflicts.length === 0) {
            const applyButton = actions.createEl('button', {
                text: `Rename ${safeItems.length} ${safeItems.length === 1 ? 'note' : 'notes'}`,
                cls: 'mod-cta',
            });
            applyButton.type = 'button';
            applyButton.addEventListener('click', () => this.finish(true));
        }
        cancelButton.focus();
    }

    onClose() {
        this.contentEl.empty();
        if (!this.settled) {
            this.settled = true;
            this.resolve(false);
        }
    }

    private renderCloseAction() {
        const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
        const closeButton = actions.createEl('button', { text: 'Close', cls: 'mod-cta' });
        closeButton.type = 'button';
        closeButton.addEventListener('click', () => this.finish(false));
        closeButton.focus();
    }

    private finish(apply: boolean) {
        if (this.settled) return;
        this.settled = true;
        this.resolve(apply);
        this.close();
    }
}

export function openPromptLibraryModal(app: App, initialValue: PromptLibraryDraft | null) {
    return new Promise<PromptLibraryDraft | null>(resolve => {
        new PromptLibraryModal(app, initialValue, resolve).open();
    });
}

export function confirmDeletePromptLibrary(app: App, library: PromptLibraryListItem) {
    return new Promise<boolean>(resolve => {
        new DeletePromptLibraryModal(app, library, resolve).open();
    });
}

export function previewNoteMigration(app: App, format: string, items: JournalNoteMigrationItem[]) {
    return new Promise<boolean>(resolve => {
        new NoteMigrationPreviewModal(app, format, items, resolve).open();
    });
}

function countPrompts(value: string) {
    return value.split('\n').map(line => line.trim()).filter(Boolean).length;
}
