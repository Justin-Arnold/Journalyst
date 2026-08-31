import {
    App,
    Component,
    MarkdownRenderer,
    Modal,
    Notice,
    setIcon,
} from 'obsidian';

interface SynthesisPreviewModalOptions {
    title: string;
    markdown: string;
    sourcePath: string;
    primaryLabel: string;
    primaryIcon: string;
    onPrimary: () => Promise<void>;
}

class SynthesisPreviewModal extends Modal {
    private renderComponent: Component | null = null;

    constructor(app: App, private readonly options: SynthesisPreviewModalOptions) {
        super(app);
    }

    async onOpen() {
        this.modalEl.addClasses(['journalyst-modal', 'journalyst-synthesis-preview-modal']);
        this.setTitle(this.options.title);

        const previewEl = this.contentEl.createDiv({ cls: 'journalyst-synthesis-preview-content markdown-rendered' });
        this.renderComponent = new Component();
        this.renderComponent.load();
        try {
            await MarkdownRenderer.render(
                this.app,
                this.options.markdown,
                previewEl,
                this.options.sourcePath,
                this.renderComponent,
            );
        } catch {
            previewEl.empty();
            previewEl.createEl('pre', {
                text: this.options.markdown,
                cls: 'journalyst-type-code',
            });
        }

        const actionsEl = this.contentEl.createDiv({ cls: 'journalyst-synthesis-preview-actions' });
        const closeButton = actionsEl.createEl('button', { text: 'Close' });
        closeButton.addEventListener('click', () => this.close());

        const primaryButton = actionsEl.createEl('button', {
            cls: 'mod-cta',
            text: this.options.primaryLabel,
        });
        const iconEl = primaryButton.createSpan();
        primaryButton.prepend(iconEl);
        setIcon(iconEl, this.options.primaryIcon);
        primaryButton.addEventListener('click', async () => {
            primaryButton.disabled = true;
            closeButton.disabled = true;
            try {
                await this.options.onPrimary();
                this.close();
            } catch (error) {
                primaryButton.disabled = false;
                closeButton.disabled = false;
                new Notice(error instanceof Error ? error.message : 'Journalyst could not complete that synthesis action.');
            }
        });
    }

    onClose() {
        this.renderComponent?.unload();
        this.renderComponent = null;
        this.contentEl.empty();
    }
}

export function openSynthesisPreviewModal(app: App, options: SynthesisPreviewModalOptions) {
    new SynthesisPreviewModal(app, options).open();
}
