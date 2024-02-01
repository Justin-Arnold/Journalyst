import { App, PluginSettingTab, Setting, TFolder } from 'obsidian';
import JournalystPlugin from "../main";

export class JournalystSettingsTab extends PluginSettingTab {
	plugin: JournalystPlugin;

	constructor(app: App, plugin: JournalystPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Journalyst Home Directory')
			.setDesc('The directory where Journalyst will look for your journals.')
			.addDropdown(dropdown => {
				this.app.vault.getAllLoadedFiles()
					.filter(file => file instanceof TFolder)
					.forEach(folder => {
						dropdown.addOption(folder.path, folder.path);
					});
				dropdown.setValue(this.plugin.settings.rootDirectory)
					.onChange(async (value) => {
						this.plugin.settings.rootDirectory = value;
						await this.plugin.saveSettings();
					});
			});
	}
}