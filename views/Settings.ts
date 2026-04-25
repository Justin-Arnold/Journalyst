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

		const templaterAvailability = this.plugin.getTemplaterAvailability();
		const templaterTemplateFiles = this.plugin.getTemplaterTemplateFiles();

		if (templaterAvailability === 'not-installed') {
			this.addTemplaterNotice('Templater is not installed. Install and enable Templater to choose templates for Journalyst journals.');
			return;
		}

		if (templaterAvailability === 'disabled') {
			this.addTemplaterNotice('Templater is installed but not enabled. Enable Templater to choose templates for Journalyst journals.');
			return;
		}

		if (templaterAvailability === 'no-template-folder') {
			this.addTemplaterNotice('Templater does not have a template folder configured. Set "Template folder location" in Templater settings first.');
			return;
		}

		if (templaterTemplateFiles.length === 0) {
			const templateFolder = this.plugin.getTemplaterTemplateFolder();
			this.addTemplaterNotice(`No markdown templates were found in ${templateFolder}. Add templates there to assign them to Journalyst journals.`);
			return;
		}

		this.plugin.journals.forEach(journal => {
			new Setting(containerEl)
				.setName(journal.name)
				.setDesc(`Template for journal entries in ${journal.path}.`)
				.addDropdown(dropdown => {
					dropdown.addOption('', 'None');

					templaterTemplateFiles.forEach(file => {
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

	private addTemplaterNotice(message: string) {
		new Setting(this.containerEl)
			.setDesc(message);
	}
}
