import { Plugin, TFolder, normalizePath, WorkspaceLeaf } from 'obsidian';
import { SideBarView, VIEW_TYPE_SIDE_BAR } from "./views/SideBar";
import { JournalystSettingsTab } from "./views/Settings";

interface JournalystPluginSettings {
    rootDirectory: string;
}

const DEFAULT_SETTINGS: JournalystPluginSettings = {
	rootDirectory: '/'
}

export default class JournalystPlugin extends Plugin {
	settings: JournalystPluginSettings;
    journals: TFolder[] = [];

	async onload() {
		await this.loadSettings();
        this.addSettingTab(new JournalystSettingsTab(this.app, this));

		const ribbonIconEl = this.addRibbonIcon('book-copy', 'Go to Journalyst view', () => {
            this.activateView();
        });


        this.app.workspace.onLayoutReady(() => {
            const rootFolder = this.app.vault.getAbstractFileByPath(this.settings.rootDirectory);

            if (rootFolder instanceof TFolder === false) {
                return;
            }

            rootFolder.children.forEach(child => {
                if (child instanceof TFolder === false) {
                    return;
                }

                this.journals.push(child);

                this.addCommand({
                    id: 'create-journal-' + child.name,
                    name: 'Create new journal in ' + child.name,
                    callback: () => {
                        const todaysDate = new Date().toISOString().slice(0, 10);
                        const newFileName = todaysDate + '.md';
                        const fullPath = normalizePath(child.path + '/' + newFileName);
                        this.app.vault.create(fullPath, '---\ntitle: ' + todaysDate + '\n---\n')
                    }
                })
            })

            this.registerView(
                VIEW_TYPE_SIDE_BAR,
                (leaf) => new SideBarView(leaf, this)
            );
        })
    };

	onunload() {

	}

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_SIDE_BAR);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_SIDE_BAR, active: true });
        }

        // "Reveal" the leaf in case it is in a collapsed sidebar
        workspace.revealLeaf(leaf);
    }


	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}