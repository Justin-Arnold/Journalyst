import { ItemView, WorkspaceLeaf, TFolder } from "obsidian";
import JournalystPlugin from "../main";

export const VIEW_TYPE_SIDE_BAR = "journalyst-side-bar-view";

export class SideBarView extends ItemView {
    plugin: JournalystPlugin;
    rootContainer: Element;

    constructor(leaf: WorkspaceLeaf, plugin: JournalystPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_SIDE_BAR;
    }

    getDisplayText() {
        return "Journalyst";
    }

    async onOpen() {
            this.rootContainer = this.containerEl.children[1];
            this.rootContainer.empty();
            this.addHeader();
            this.addJournalSections();
    }

    async onClose() {
        // Nothing to clean up.
    }

    private addHeader(): void {
        this.rootContainer.createEl("h3", { text: "Journals" });
    }

    private addJournalSections(): void {
        this.plugin.journals.forEach((journal: TFolder) => {
            const journalSection = this.rootContainer.createEl("div")
            journalSection.addClass("journal-section");
            journalSection.createEl("h4", { text: journal.name });

            const gotoButton = journalSection.createEl("button", { text: "Go To Today" });
            gotoButton.addClass("journal-section-button");
            gotoButton.addEventListener("click", () => {
                this.goToToday(journal);
            });
        });
    }

    private goToToday(journalFolder: TFolder) {
        const today = new Date();
        const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.md`;
        const todayFile = journalFolder.children.find(file => file.name === todayString);
        if (todayFile) {
            // If the file exists, open it
            this.app.workspace.openLinkText(todayFile.path, '/', false);
        } else {
            // If the file does not exist, create it
            const newFilePath = `${journalFolder.path}/${todayString}`;

            const newFileContents = `---\nreviewed: false\n---`
            this.app.vault.create(newFilePath, newFileContents).then((file) => {
                // Then open the new file
                this.app.workspace.openLinkText(file.path, '/', false);
            });
        }
    }
}