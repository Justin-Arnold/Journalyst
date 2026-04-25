import { App, PluginSettingTab, Setting, TFolder } from 'obsidian';
import { JournalCadenceType } from "../cadence";
import { TemplateEngine } from "../templates/types";
import JournalystPlugin from "../main";

export class JournalystSettingsTab extends PluginSettingTab {
	plugin: JournalystPlugin;
	private noteDateFormatDraft: string | null = null;
	private migrationPreviewFormat: string | null = null;
	private readonly migrationPreviewLimit = 24;

	constructor(app: App, plugin: JournalystPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		void this.displayAsync();
	}

	private async displayAsync() {
		const {containerEl} = this;
		if (this.noteDateFormatDraft === null) {
			this.noteDateFormatDraft = this.plugin.settings.noteDateFormat;
		}

		const noteDateFormatDraft = this.noteDateFormatDraft;

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

		const noteNameExample = noteDateFormatDraft.trim()
			? this.plugin.formatJournalNoteFileNameForFormat('2026-04-25', noteDateFormatDraft.trim())
			: 'YYYY-MM-DD.md';
		new Setting(containerEl)
			.setName('Journal note date format')
			.setDesc(`Use Moment-style date tokens for note filenames. Example output: ${noteNameExample}`)
			.addText(text => {
				text.setPlaceholder('YYYY-MM-DD')
					.setValue(noteDateFormatDraft)
					.onChange((value) => {
						this.noteDateFormatDraft = value;
					});
			})
			.addButton(button => {
				button.setButtonText('Preview renames')
					.setDisabled(!noteDateFormatDraft.trim())
					.onClick(() => {
						this.migrationPreviewFormat = this.noteDateFormatDraft?.trim() || null;
						this.display();
					});
			})
			.addButton(button => {
				button.setButtonText('Save format')
					.setCta()
					.setDisabled(!noteDateFormatDraft.trim() || noteDateFormatDraft.trim() === this.plugin.settings.noteDateFormat)
					.onClick(async () => {
						const nextFormat = this.noteDateFormatDraft?.trim() || '';
						if (!nextFormat) {
							return;
						}

						await this.plugin.updateNoteDateFormat(nextFormat);
						this.noteDateFormatDraft = this.plugin.settings.noteDateFormat;
						if (this.migrationPreviewFormat) {
							this.migrationPreviewFormat = nextFormat;
						}
						this.display();
					});
			});

		if (this.migrationPreviewFormat) {
			const migrationPlan = this.plugin.getJournalMigrationPlanForFormat(this.migrationPreviewFormat);
			const conflictingMigrationItems = migrationPlan.filter(item => item.hasConflict);
			const safeMigrationItems = migrationPlan.filter(item => !item.hasConflict);
			const visibleMigrationItems = migrationPlan.slice(0, this.migrationPreviewLimit);
			const hiddenCount = Math.max(0, migrationPlan.length - visibleMigrationItems.length);

			containerEl.createEl('h3', { text: 'Rename journal notes' });
			new Setting(containerEl)
				.setName('Migration preview')
				.setDesc(
					migrationPlan.length === 0
						? `No journal notes need renaming for ${this.migrationPreviewFormat}.`
						: conflictingMigrationItems.length > 0
							? `Found ${migrationPlan.length} rename candidates with ${conflictingMigrationItems.length} conflicts to resolve first.`
							: `Found ${migrationPlan.length} journal notes that can be renamed to match ${this.migrationPreviewFormat}.`
				)
				.addButton(button => {
					button.setButtonText(`Rename ${safeMigrationItems.length} notes`)
						.setDisabled(migrationPlan.length === 0 || safeMigrationItems.length === 0 || conflictingMigrationItems.length > 0)
						.onClick(async () => {
							await this.plugin.applyJournalMigrationPlan(safeMigrationItems);
							this.display();
						});
				})
				.addExtraButton(button => {
					button.setIcon('cross')
						.setTooltip('Hide migration preview')
						.onClick(() => {
							this.migrationPreviewFormat = null;
							this.display();
						});
				});

			if (migrationPlan.length > 0) {
				const migrationList = containerEl.createDiv({ cls: 'journalyst-migration-list' });
				visibleMigrationItems.forEach(item => {
					const row = migrationList.createDiv({ cls: 'journalyst-migration-row' });
					row.createEl('code', { text: item.currentPath });
					row.createEl('span', { text: '->', cls: 'journalyst-migration-arrow' });
					row.createEl('code', { text: item.targetPath });

					if (item.hasConflict) {
						row.createEl('span', {
							text: `Conflict with ${item.conflictPath}`,
							cls: 'journalyst-migration-conflict',
						});
					}
				});

				if (hiddenCount > 0) {
					containerEl.createEl('p', {
						text: `Showing ${visibleMigrationItems.length} examples out of ${migrationPlan.length} rename candidates.`,
						cls: 'journalyst-migration-summary',
					});
				}
			}
		}

		containerEl.createEl('h3', { text: 'Journal cadence' });
		for (const journal of this.plugin.journals) {
			const cadence = this.plugin.getJournalCadence(journal.path);
			new Setting(containerEl)
				.setName(journal.name)
				.setDesc('Set how often this journal is expected so review and missed-entry awareness stay honest.')
				.addDropdown(dropdown => {
					dropdown.addOption('daily', 'Daily');
					dropdown.addOption('weekdays', 'Weekdays only');
					dropdown.addOption('weekly-days', 'Specific weekdays');
					dropdown.addOption('interval', 'Custom interval');
					dropdown.addOption('adhoc', 'Ad hoc / no tracking');
					dropdown.setValue(cadence.type)
						.onChange(async (value: JournalCadenceType) => {
							const nextCadence = value === 'weekly-days'
								? { type: value, weekdays: cadence.weekdays ?? [1] }
								: value === 'interval'
									? { type: value, intervalDays: cadence.intervalDays ?? 3, startDate: cadence.startDate }
									: { type: value };
							await this.plugin.updateJournalCadence(journal.path, nextCadence);
							this.display();
						});
				});

			if (cadence.type === 'weekly-days') {
				const detail = containerEl.createDiv({ cls: 'journalyst-cadence-detail' });
				detail.createEl('span', { text: 'Expected weekdays', cls: 'journalyst-cadence-label' });
				const buttonRow = detail.createDiv({ cls: 'journalyst-cadence-weekdays' });

				['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((label, day) => {
					const button = buttonRow.createEl('button', { text: label, cls: 'journalyst-cadence-day' });
					button.type = 'button';
					if (cadence.weekdays?.includes(day)) {
						button.addClass('is-selected');
					}
					button.addEventListener('click', async () => {
						const nextWeekdays = new Set(cadence.weekdays ?? []);
						if (nextWeekdays.has(day)) {
							nextWeekdays.delete(day);
						} else {
							nextWeekdays.add(day);
						}

						await this.plugin.updateJournalCadence(journal.path, {
							type: 'weekly-days',
							weekdays: Array.from(nextWeekdays).sort((left, right) => left - right),
						});
						this.display();
					});
				});
			}

			if (cadence.type === 'interval') {
				new Setting(containerEl)
					.setName(`${journal.name} interval`)
					.setDesc('Choose how many days should pass between expected entries, plus the anchor date for the schedule.')
					.addText(text => {
						text.setPlaceholder('3')
							.setValue(String(cadence.intervalDays ?? 3))
							.onChange(async (value) => {
								const intervalDays = Math.max(1, Number.parseInt(value, 10) || 1);
								await this.plugin.updateJournalCadence(journal.path, {
									type: 'interval',
									intervalDays,
									startDate: cadence.startDate,
								});
							});
					})
					.addText(text => {
						text.inputEl.type = 'date';
						text.setValue(cadence.startDate ?? '')
							.onChange(async (value) => {
								await this.plugin.updateJournalCadence(journal.path, {
									type: 'interval',
									intervalDays: cadence.intervalDays ?? 3,
									startDate: value,
								});
							});
					});
			}
		}

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
