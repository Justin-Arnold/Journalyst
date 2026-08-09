import { App, Modal, Setting } from "obsidian";
import type { CompleteOnboardingResult } from "../onboarding";

export class NewJournalModal extends Modal {
    constructor(
        app: App,
        private readonly createJournal: (journalName: string) => Promise<CompleteOnboardingResult>,
    ) {
        super(app);
    }

    onOpen() {
        this.setTitle('New journal');
        this.contentEl.empty();

        const form = this.contentEl.createEl('form', { cls: 'journalyst-new-journal-form' });
        form.createEl('p', {
            text: 'Create a journal folder inside your configured Journalyst home directory.',
            cls: 'setting-item-description',
        });

        let nameInput!: HTMLInputElement;
        new Setting(form)
            .setName('Journal name')
            .addText(text => {
                text.setPlaceholder('Journal name');
                text.inputEl.required = true;
                text.inputEl.autocomplete = 'off';
                nameInput = text.inputEl;
            });

        const errorEl = form.createDiv({ cls: 'journalyst-new-journal-error' });
        errorEl.setAttr('role', 'alert');

        const buttonContainer = form.createDiv({ cls: 'modal-button-container' });
        const cancelButton = buttonContainer.createEl('button', { text: 'Cancel' });
        cancelButton.type = 'button';
        cancelButton.addEventListener('click', () => this.close());

        const createButton = buttonContainer.createEl('button', { text: 'Create journal', cls: 'mod-cta' });
        createButton.type = 'submit';

        form.addEventListener('submit', event => {
            event.preventDefault();
            if (createButton.disabled) {
                return;
            }

            void this.submit(nameInput, createButton, errorEl);
        });

        nameInput?.focus();
    }

    onClose() {
        this.contentEl.empty();
    }

    private async submit(input: HTMLInputElement, createButton: HTMLButtonElement, errorEl: HTMLElement) {
        createButton.disabled = true;
        createButton.setText('Creating...');
        errorEl.empty();

        try {
            const result = await this.createJournal(input.value);
            if (result.ok) {
                this.close();
                return;
            }

            errorEl.setText(result.error);
        } catch (error) {
            errorEl.setText(error instanceof Error
                ? error.message
                : 'Journalyst could not create the journal. Try again.');
        } finally {
            createButton.disabled = false;
            createButton.setText('Create journal');
        }
    }
}
