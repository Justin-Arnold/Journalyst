import { App, Modal, Setting } from 'obsidian';
import moment from 'moment';
import type { JournalSchedulePause } from '../cadence';
import type {
    JournalSchedulePauseActionResult,
    JournalSchedulePauseUpdate,
} from '../journalSettings';

class SchedulePauseModal extends Modal {
    private settled = false;

    constructor(
        app: App,
        private readonly pause: JournalSchedulePause | null,
        private readonly save: (update: JournalSchedulePauseUpdate) => Promise<JournalSchedulePauseActionResult>,
        private readonly resolve: (result: JournalSchedulePauseActionResult | null) => void,
    ) {
        super(app);
    }

    onOpen() {
        this.modalEl.addClass('journalyst-modal');
        this.setTitle(this.pause ? 'Edit schedule pause' : 'Add schedule pause');
        this.contentEl.empty();

        const form = this.contentEl.createEl('form', { cls: 'journalyst-schedule-pause-form' });
        form.createEl('p', {
            text: 'Paused dates are excluded from entry expectations and entry reminders.',
            cls: 'setting-item-description',
        });

        let nameInput!: HTMLInputElement;
        let startInput!: HTMLInputElement;
        let endInput!: HTMLInputElement;
        const defaultDate = moment().format('YYYY-MM-DD');

        new Setting(form)
            .setName('Name')
            .setDesc('For example, Holiday or Writing break.')
            .addText(text => {
                text.setValue(this.pause?.name ?? '');
                text.setPlaceholder('Pause name');
                text.inputEl.required = true;
                text.inputEl.autocomplete = 'off';
                nameInput = text.inputEl;
            });

        new Setting(form)
            .setName('Start date')
            .addText(text => {
                text.setValue(this.pause?.startDate ?? defaultDate);
                text.inputEl.type = 'date';
                text.inputEl.required = true;
                startInput = text.inputEl;
            });

        new Setting(form)
            .setName('End date')
            .setDesc('Use the same date for a one-day exception.')
            .addText(text => {
                text.setValue(this.pause?.endDate ?? defaultDate);
                text.inputEl.type = 'date';
                text.inputEl.required = true;
                endInput = text.inputEl;
            });

        const errorEl = form.createDiv({ cls: 'journalyst-schedule-pause-error' });
        errorEl.setAttr('role', 'alert');

        const actions = form.createDiv({ cls: 'modal-button-container' });
        const cancelButton = actions.createEl('button', { text: 'Cancel' });
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', () => this.close());

        const saveButton = actions.createEl('button', {
            text: this.pause ? 'Save pause' : 'Add pause',
            cls: 'mod-cta',
        });
        saveButton.type = 'submit';

        form.addEventListener('submit', event => {
            event.preventDefault();
            if (!saveButton.disabled) {
                void this.submit(nameInput, startInput, endInput, saveButton, errorEl);
            }
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

    private async submit(
        nameInput: HTMLInputElement,
        startInput: HTMLInputElement,
        endInput: HTMLInputElement,
        saveButton: HTMLButtonElement,
        errorEl: HTMLElement,
    ) {
        saveButton.disabled = true;
        saveButton.setText('Saving...');
        errorEl.empty();

        try {
            const result = await this.save({
                id: this.pause?.id,
                name: nameInput.value,
                startDate: startInput.value,
                endDate: endInput.value,
            });
            if (!result.ok) {
                errorEl.setText(result.error);
                return;
            }

            this.settled = true;
            this.resolve(result);
            this.close();
        } catch (error) {
            errorEl.setText(error instanceof Error
                ? error.message
                : 'Journalyst could not save the schedule pause.');
        } finally {
            saveButton.disabled = false;
            saveButton.setText(this.pause ? 'Save pause' : 'Add pause');
        }
    }
}

class RemoveSchedulePauseModal extends Modal {
    private settled = false;

    constructor(
        app: App,
        private readonly pause: JournalSchedulePause,
        private readonly resolve: (remove: boolean) => void,
    ) {
        super(app);
    }

    onOpen() {
        this.modalEl.addClass('journalyst-modal');
        this.setTitle('Remove schedule pause?');
        this.contentEl.createEl('p', {
            text: `Removing "${this.pause.name}" will recalculate expectations for ${this.pause.startDate} through ${this.pause.endDate}.`,
        });

        const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
        const cancelButton = actions.createEl('button', { text: 'Keep pause' });
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', () => this.finish(false));

        const removeButton = actions.createEl('button', { text: 'Remove pause', cls: 'mod-warning' });
        removeButton.type = 'button';
        removeButton.addEventListener('click', () => this.finish(true));
        cancelButton.focus();
    }

    onClose() {
        this.contentEl.empty();
        if (!this.settled) {
            this.settled = true;
            this.resolve(false);
        }
    }

    private finish(remove: boolean) {
        if (this.settled) return;
        this.settled = true;
        this.resolve(remove);
        this.close();
    }
}

export function openSchedulePauseModal(
    app: App,
    pause: JournalSchedulePause | null,
    save: (update: JournalSchedulePauseUpdate) => Promise<JournalSchedulePauseActionResult>,
) {
    return new Promise<JournalSchedulePauseActionResult | null>(resolve => {
        new SchedulePauseModal(app, pause, save, resolve).open();
    });
}

export function confirmRemoveSchedulePause(app: App, pause: JournalSchedulePause) {
    return new Promise<boolean>(resolve => {
        new RemoveSchedulePauseModal(app, pause, resolve).open();
    });
}
