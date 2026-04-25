import { App, PluginSettingTab, Setting, TFolder } from 'obsidian';
import { TemplateEngine } from "../templates/types";
import JournalystPlugin from "../main";

export class JournalystSettingsTab extends PluginSettingTab {
	plugin: JournalystPlugin;

	constructor(app: App, plugin: JournalystPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		void this.displayAsync();
	}

	private async displayAsync() {
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

		new Setting(containerEl)
			.setName('Template engine')
			.setDesc('Choose which template system Journalyst should use when creating journal entries.')
			.addDropdown(dropdown => {
				dropdown.addOption('none', 'None');
				dropdown.addOption('core', 'Obsidian Templates');
				dropdown.addOption('templater', 'Templater');
				dropdown.setValue(this.plugin.settings.templateEngine)
					.onChange(async (value: TemplateEngine) => {
						this.plugin.settings.templateEngine = value;
						await this.plugin.saveSettings();
						this.display();
					});
			});

		containerEl.createEl('h3', { text: 'Journal templates' });

		if (this.plugin.settings.templateEngine === 'none') {
			this.addTemplateNotice('Journalyst will create entries with its default note content.');
			return;
		}

		const templateEngine = this.plugin.settings.templateEngine;
		const templateAvailability = await this.plugin.getTemplateAvailability(templateEngine);
		const templateFiles = await this.plugin.getTemplateFiles(templateEngine);

		if (templateAvailability === 'not-installed') {
			this.addTemplateNotice('Templater is not installed. Install and enable Templater to choose templates for Journalyst journals.');
			return;
		}

		if (templateAvailability === 'disabled') {
			if (templateEngine === 'core') {
				this.addTemplateNotice('The core Templates plugin is not enabled. Enable it in Core plugins to choose templates for Journalyst journals.');
			} else {
				this.addTemplateNotice('Templater is installed but not enabled. Enable Templater to choose templates for Journalyst journals.');
			}
			return;
		}

		if (templateAvailability === 'no-template-folder') {
			if (templateEngine === 'core') {
				this.addTemplateNotice('The core Templates plugin does not have a template folder configured. Set "Template folder location" in Templates settings first.');
			} else {
				this.addTemplateNotice('Templater does not have a template folder configured. Set "Template folder location" in Templater settings first.');
			}
			return;
		}

		if (templateFiles.length === 0) {
			const templateFolder = await this.plugin.getTemplateFolder(templateEngine);
			this.addTemplateNotice(`No markdown templates were found in ${templateFolder}. Add templates there to assign them to Journalyst journals.`);
			return;
		}

		this.plugin.journals.forEach(journal => {
			new Setting(containerEl)
				.setName(journal.name)
				.setDesc(`Template for journal entries in ${journal.path}.`)
				.addDropdown(dropdown => {
					dropdown.addOption('', 'None');

					templateFiles.forEach(file => {
						dropdown.addOption(file.path, file.path);
					});

					dropdown.setValue(this.plugin.getJournalTemplatePath(templateEngine, journal.path) ?? '')
						.onChange(async (value) => {
							if (value) {
								this.plugin.setJournalTemplatePath(templateEngine, journal.path, value);
							} else {
								this.plugin.clearJournalTemplatePath(templateEngine, journal.path);
							}

							await this.plugin.saveSettings();
						});
				});
		});
	}

	private addTemplateNotice(message: string) {
		new Setting(this.containerEl)
			.setDesc(message);
	}
}
