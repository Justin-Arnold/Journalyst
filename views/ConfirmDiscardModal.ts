import { App, Modal } from 'obsidian';

export class ConfirmDiscardModal extends Modal {
    private settled = false;

    constructor(app: App, private readonly resolve: (discard: boolean) => void) {
        super(app);
    }

    onOpen() {
        this.modalEl.addClass('journalyst-modal');
        this.setTitle('Leave without saving changes?');
        this.contentEl.createEl('p', {
            text: 'The current value is invalid or could not be saved. Stay to fix or retry it, or discard the local change.',
        });

        const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
        const stayButton = actions.createEl('button', { text: 'Stay' });
        stayButton.type = 'button';
        stayButton.addEventListener('click', () => this.finish(false));

        const discardButton = actions.createEl('button', { text: 'Discard local change', cls: 'mod-warning' });
        discardButton.type = 'button';
        discardButton.addEventListener('click', () => this.finish(true));
        stayButton.focus();
    }

    onClose() {
        this.contentEl.empty();
        if (!this.settled) {
            this.settled = true;
            this.resolve(false);
        }
    }

    private finish(discard: boolean) {
        if (this.settled) return;
        this.settled = true;
        this.resolve(discard);
        this.close();
    }
}

export function confirmDiscardJournalAutosave(app: App) {
    return new Promise<boolean>(resolve => {
        new ConfirmDiscardModal(app, resolve).open();
    });
}
