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

            this.createHeatMap(journal, journalSection)

            const gotoButton = journalSection.createEl("button", { text: "Go To Today" });
            gotoButton.addClass("journal-section-button");
            gotoButton.addEventListener("click", () => {
                this.goToDay(journal);
            });
        });
    }

    private createHeatMap(journal: TFolder, journalSection: HTMLElement): void {
        const heatMapWrapper = journalSection.createEl("div", { cls: "heat-map-wrapper" });

        const days = ['S', 'M', 'T', 'W', 'Th', 'F', 'S'];



        days.forEach(day => {
            const dayEl = heatMapWrapper.createEl('span', { text: day });
            dayEl.addClass('heat-map-day-label');
        });


        const startOfMonthOffset = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay();
        for (let i = 0; i < startOfMonthOffset; i++) {
            const day = heatMapWrapper.createEl("div", { cls: "heat-map-offset" });
        }

        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        for (let i = 1; i <= daysInMonth; i++) {
            const day = heatMapWrapper.createEl("div", { cls: "heat-map-day", text: String(i) });
            const dayString = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}.md`;
            day.addEventListener("click", () => {
                this.goToDay(journal, dayString);
            });
            const dayFile = this.plugin.app.vault.getAbstractFileByPath(journal.path + "/" + dayString);
            if (dayFile) {
                day.addClass("heat-map-day-exists");
            }
        }
    }

    private goToDay(journalFolder: TFolder, date?: string) {
        const today = new Date();
        const dayString = date ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.md`;
        const dayFile = journalFolder.children.find(file => file.name === dayString);
        if (dayFile) {
            this.app.workspace.openLinkText(dayFile.path, '/', false);
        } else {
            const newFilePath = `${journalFolder.path}/${dayString}`;
            const newFileContents = `---\nreviewed: false\n---`
            this.app.vault.create(newFilePath, newFileContents).then((file) => {
                this.app.workspace.openLinkText(file.path, '/', false);
            });
        }
    }
}