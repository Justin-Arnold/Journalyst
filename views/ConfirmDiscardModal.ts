import { App, Modal } from 'obsidian';

export class ConfirmDiscardModal extends Modal {
    private settled = false;

    constructor(app: App, private readonly resolve: (discard: boolean) => void) {
        super(app);
    }

    onOpen() {
        this.setTitle('Discard unsaved changes?');
        this.contentEl.createEl('p', {
            text: 'This section has changes that have not been saved yet.',
        });

        const actions = this.contentEl.createDiv({ cls: 'modal-button-container' });
        const stayButton = actions.createEl('button', { text: 'Keep editing' });
        stayButton.type = 'button';
        stayButton.addEventListener('click', () => this.finish(false));

        const discardButton = actions.createEl('button', { text: 'Discard changes', cls: 'mod-warning' });
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

export function confirmDiscardJournalChanges(app: App) {
    return new Promise<boolean>(resolve => {
        new ConfirmDiscardModal(app, resolve).open();
    });
}
