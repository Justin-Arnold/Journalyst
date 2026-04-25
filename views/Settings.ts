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

		// The settings view depends on live vault/plugin state, so redraw it from
		// scratch whenever an option change affects the available controls.
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

		new Setting(containerEl)
			.setName('Template failure behavior')
			.setDesc('Choose whether Journalyst should create its default note when a configured template cannot be applied.')
			.addDropdown(dropdown => {
				dropdown.addOption('fallback-default', 'Create default note');
				dropdown.addOption('abort', 'Abort with notice');
				dropdown.setValue(this.plugin.settings.templateFailureBehavior)
					.onChange(async (value) => {
						this.plugin.settings.templateFailureBehavior = value as typeof this.plugin.settings.templateFailureBehavior;
						await this.plugin.saveSettings();
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

		if (templateEngine === 'core') {
			this.addTemplateNotice('Core Templates supports plain placeholder substitution such as {{title}}, {{date}}, and {{time}}.');
		} else {
			this.addTemplateNotice('Templater templates are executed by the Templater plugin, so Journalyst defers rendering to Templater.');
		}

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

		for (const journal of this.plugin.journals) {
			const templatePath = this.plugin.getJournalTemplatePath(templateEngine, journal.path);
			const templateStatus = await this.plugin.getJournalTemplateStatus(templateEngine, journal.path);
			const warningMessage = this.getTemplateWarningMessage(templateStatus, templatePath);
			const description = warningMessage
				? `Template for journal entries in ${journal.path}. Warning: ${warningMessage}.`
				: `Template for journal entries in ${journal.path}.`;

			new Setting(containerEl)
				.setName(journal.name)
				.setDesc(description)
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
							this.display();
						});
				})
				.addButton(button => {
					button.setButtonText('Test today')
						.onClick(async () => {
							await this.plugin.createJournalEntry(journal);
						});
				});
		}
	}

	private addTemplateNotice(message: string) {
		new Setting(this.containerEl)
			.setDesc(message);
	}

	private getTemplateWarningMessage(templateStatus: string, templatePath?: string) {
		if (templateStatus === 'missing') {
			return `saved template is missing: ${templatePath}`;
		}

		if (templateStatus === 'outside-folder') {
			return `saved template is outside the configured template folder: ${templatePath}`;
		}

		return null;
	}
}
