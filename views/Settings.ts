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
		this.plugin.refreshJournals();

		new Setting(containerEl)
			.setName('Journalyst home directory')
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
						this.plugin.refreshJournals();
						this.display();
					});
			});

		containerEl.createEl('h3', { text: 'Templater templates' });

		this.plugin.journals.forEach(journal => {
			new Setting(containerEl)
				.setName(journal.name)
				.setDesc(`Template for journal entries in ${journal.path}.`)
				.addDropdown(dropdown => {
					dropdown.addOption('', 'None');

					this.app.vault.getMarkdownFiles()
						.forEach(file => {
							dropdown.addOption(file.path, file.path);
						});

					dropdown.setValue(this.plugin.settings.journalTemplates[journal.path] ?? '')
						.onChange(async (value) => {
							if (value) {
								this.plugin.settings.journalTemplates[journal.path] = value;
							} else {
								delete this.plugin.settings.journalTemplates[journal.path];
							}

							await this.plugin.saveSettings();
						});
				});
		});
	}
}
