import { App, FuzzySuggestModal, TFolder } from "obsidian";

export class NewEntryJournalModal extends FuzzySuggestModal<TFolder> {
    constructor(
        app: App,
        private readonly journals: TFolder[],
        private readonly selectJournal: (journal: TFolder) => void,
    ) {
        super(app);
        this.setPlaceholder("Choose a journal for today's entry");
        this.emptyStateText = 'No matching journals';
    }

    getItems() {
        return this.journals;
    }

    getItemText(journal: TFolder) {
        return journal.name;
    }

    onChooseItem(journal: TFolder) {
        this.selectJournal(journal);
    }
}
