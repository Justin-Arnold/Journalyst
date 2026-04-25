import { App, DropdownComponent, PluginSettingTab, Setting, TFolder } from 'obsidian';
import { JournalNotePropertyBackfillItem } from "../bases";
import { JournalCadenceType } from "../cadence";
import { JournalPromptSettings, PromptDeliveryMode, PromptSelectionMode, PromptSourceType } from "../prompts";
import { JournalReminderSettings, ReminderDeliveryMode, ReviewReminderPeriod } from "../reminders";
import { TemplateEngine } from "../templates/types";
import JournalystPlugin from "../main";

export class JournalystSettingsTab extends PluginSettingTab {
	plugin: JournalystPlugin;
	private noteDateFormatDraft: string | null = null;
	private migrationPreviewFormat: string | null = null;
	private readonly migrationPreviewLimit = 24;
	private customPromptListDrafts: Record<string, { name: string; body: string }> = {};
	private promptPreviewJournalPath: string | null = null;
	private basesBackfillPreview: JournalNotePropertyBackfillItem[] | null = null;
	private readonly basesPreviewLimit = 24;

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

		await this.renderReminderSettings(containerEl);

		await this.renderCustomPromptLists(containerEl);
		await this.renderJournalPromptSettings(containerEl);
		await this.renderBasesSettings(containerEl);

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

	private async renderBasesSettings(containerEl: HTMLElement) {
		containerEl.createEl('h3', { text: 'Bases integration' });
		new Setting(containerEl)
			.setName('Enable Bases integration')
			.setDesc('Write Journalyst properties into notes and generate plugin-managed .base files for each journal.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.isBasesIntegrationEnabled())
					.onChange(async value => {
						await this.plugin.updateBasesIntegrationEnabled(value);
						if (!value) {
							this.basesBackfillPreview = null;
						}
						this.display();
					});
			});

		if (!this.plugin.isBasesIntegrationEnabled()) {
			new Setting(containerEl)
				.setDesc('Bases stays completely out of the way until you opt in here.');
			return;
		}

		new Setting(containerEl)
			.setName('Managed Bases files')
			.setDesc('Generate Journalyst-owned starter Bases for your journals. Existing managed files are updated in place.')
			.addButton(button => {
				button.setButtonText('Generate all')
					.setCta()
					.onClick(async () => {
						await this.plugin.generateBasesForAllJournals();
					});
			})
			.addButton(button => {
				button.setButtonText('Preview backfill')
					.onClick(async () => {
						this.basesBackfillPreview = await this.plugin.getJournalNotePropertyBackfillPreview();
						this.display();
					});
			});

		for (const journal of this.plugin.journals) {
			new Setting(containerEl)
				.setName(`${journal.name} Bases`)
				.setDesc(`Generate or regenerate Journalyst starter Bases in ${journal.path}.`)
				.addButton(button => {
					button.setButtonText('Generate')
						.onClick(async () => {
							await this.plugin.generateBasesForJournal(journal);
						});
				});
		}

		if (!this.basesBackfillPreview) {
			return;
		}

		const backfillPreview = this.basesBackfillPreview;
		const visibleItems = backfillPreview.slice(0, this.basesPreviewLimit);
		const hiddenCount = Math.max(0, backfillPreview.length - visibleItems.length);

		new Setting(containerEl)
				.setName('Property backfill preview')
				.setDesc(
					backfillPreview.length === 0
						? 'All recognized journal notes already have the current Journalyst Bases properties.'
						: `Journalyst found ${backfillPreview.length} notes that need missing or updated properties.`
				)
				.addButton(button => {
					button.setButtonText(`Apply to ${backfillPreview.length} notes`)
						.setDisabled(backfillPreview.length === 0)
						.onClick(async () => {
							await this.plugin.applyJournalNotePropertyBackfill(backfillPreview);
							this.basesBackfillPreview = await this.plugin.getJournalNotePropertyBackfillPreview();
							this.display();
						});
			})
			.addExtraButton(button => {
				button.setIcon('cross')
					.setTooltip('Hide backfill preview')
					.onClick(() => {
						this.basesBackfillPreview = null;
						this.display();
					});
			});

		if (backfillPreview.length === 0) {
			return;
		}

		const previewList = containerEl.createDiv({ cls: 'journalyst-migration-list' });
		visibleItems.forEach(item => {
			const row = previewList.createDiv({ cls: 'journalyst-migration-row' });
			row.createEl('code', { text: item.filePath });
			const details = [
				item.entryType,
				item.missingKeys.length > 0 ? `missing: ${item.missingKeys.join(', ')}` : null,
				item.changedKeys.length > 0 ? `update: ${item.changedKeys.join(', ')}` : null,
			].filter(Boolean).join(' | ');
			row.createEl('span', { text: details, cls: 'journalyst-migration-summary' });
		});

		if (hiddenCount > 0) {
			containerEl.createEl('p', {
				text: `Showing ${visibleItems.length} examples out of ${backfillPreview.length} notes needing backfill.`,
				cls: 'journalyst-migration-summary',
			});
		}
	}

	private async renderReminderSettings(containerEl: HTMLElement) {
		containerEl.createEl('h3', { text: 'Journal reminders' });
		const permissionStatus = this.plugin.getNotificationPermissionStatus();
		const permissionText = permissionStatus === 'granted'
			? 'OS notifications are available.'
			: permissionStatus === 'denied'
				? 'OS notifications are denied, so Journalyst will fall back to in-app notices.'
				: permissionStatus === 'default'
					? 'OS notifications are not granted yet. You can request permission below.'
					: 'OS notifications are not available in this environment. Journalyst will use in-app notices.';

		new Setting(containerEl)
			.setName('Enable reminders')
			.setDesc(`Reminders only run while Obsidian is open. ${permissionText}`)
			.addToggle(toggle => {
				toggle.setValue(this.plugin.areRemindersEnabled())
					.onChange(async value => {
						await this.plugin.updateRemindersEnabled(value);
						this.display();
					});
			});

		new Setting(containerEl)
			.setName('Prefer OS notifications')
			.setDesc('When available and permitted, Journalyst will also send operating-system notifications instead of only in-app notices.')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.areOsNotificationsEnabled())
					.onChange(async value => {
						await this.plugin.updateOsNotificationsEnabled(value);
						this.display();
					});
			})
			.addButton(button => {
				button.setButtonText('Request permission')
					.setDisabled(permissionStatus === 'granted' || permissionStatus === 'unsupported')
					.onClick(async () => {
						await this.plugin.requestNotificationPermission();
						this.display();
					});
			})
			.addButton(button => {
				button.setButtonText('Test notification')
					.setDisabled(!this.plugin.areRemindersEnabled())
					.onClick(async () => {
						await this.plugin.sendTestReminderNotification();
					});
			});

		if (!this.plugin.areRemindersEnabled()) {
			return;
		}

		for (const journal of this.plugin.journals) {
			const cadence = this.plugin.getJournalCadence(journal.path);
			const reminderSettings = this.plugin.getJournalReminderSettings(journal.path);

			if (cadence.type !== 'adhoc') {
				new Setting(containerEl)
					.setName(`${journal.name} entry reminder`)
					.setDesc('Notify once when a tracked journal entry is due and still missing.')
					.addToggle(toggle => {
						toggle.setValue(reminderSettings.entryReminder.enabled)
							.onChange(async value => {
								await this.plugin.updateJournalReminderSettings(journal.path, {
									...reminderSettings,
									entryReminder: {
										...reminderSettings.entryReminder,
										enabled: value,
									},
								});
								this.display();
							});
					})
					.addText(text => {
						text.inputEl.type = 'time';
						text.setValue(reminderSettings.entryReminder.time)
							.onChange(async value => {
								await this.plugin.updateJournalReminderSettings(journal.path, {
									...reminderSettings,
									entryReminder: {
										...reminderSettings.entryReminder,
										time: value,
									},
								});
							});
					})
					.addDropdown(dropdown => {
						this.addReminderDeliveryOptions(dropdown);
						dropdown.setValue(reminderSettings.entryReminder.deliveryMode)
							.onChange(async (value: ReminderDeliveryMode) => {
								await this.plugin.updateJournalReminderSettings(journal.path, {
									...reminderSettings,
									entryReminder: {
										...reminderSettings.entryReminder,
										deliveryMode: value,
									},
								});
							});
					});
			}

			this.renderReviewReminderSetting(containerEl, journal.path, journal.name, reminderSettings, 'weekly');
			this.renderReviewReminderSetting(containerEl, journal.path, journal.name, reminderSettings, 'monthly');
			this.renderReviewReminderSetting(containerEl, journal.path, journal.name, reminderSettings, 'quarterly');
		}
	}

	private async renderCustomPromptLists(containerEl: HTMLElement) {
		containerEl.createEl('h3', { text: 'Custom prompt lists' });
		new Setting(containerEl)
			.setName('Manage prompt libraries')
			.setDesc('Create settings-managed prompt lists using one prompt per line.')
			.addButton(button => {
				button.setButtonText('Add list')
					.setCta()
					.onClick(async () => {
						const listId = this.plugin.createCustomPromptListId();
						await this.plugin.upsertCustomPromptList(listId, 'New Prompt List', '');
						this.customPromptListDrafts[listId] = { name: 'New Prompt List', body: '' };
						this.display();
					});
			});

		Object.values(this.plugin.getCustomPromptLists()).forEach(list => {
			const draft = this.getCustomPromptListDraft(list.id, list.name, list.prompts.join('\n'));
			new Setting(containerEl)
				.setName(list.name)
				.setDesc('One prompt per line. Save after editing the list name or body.')
				.addText(text => {
					text.setPlaceholder('Prompt list name')
						.setValue(draft.name)
						.onChange(value => {
							this.customPromptListDrafts[list.id] = {
								...draft,
								name: value,
							};
						});
				})
				.addButton(button => {
					button.setButtonText('Save')
						.onClick(async () => {
							const nextDraft = this.customPromptListDrafts[list.id] ?? draft;
							await this.plugin.upsertCustomPromptList(list.id, nextDraft.name, nextDraft.body);
							this.display();
						});
				})
				.addExtraButton(button => {
					button.setIcon('trash')
						.setTooltip('Delete prompt list')
						.onClick(async () => {
							delete this.customPromptListDrafts[list.id];
							await this.plugin.deleteCustomPromptList(list.id);
							this.display();
						});
				});

			const textarea = containerEl.createEl('textarea', { cls: 'journalyst-prompt-textarea' });
			textarea.value = draft.body;
			textarea.rows = Math.max(4, Math.min(10, draft.body.split('\n').length || 4));
			textarea.placeholder = 'Write one prompt per line';
			textarea.addEventListener('input', () => {
				this.customPromptListDrafts[list.id] = {
					...draft,
					body: textarea.value,
				};
			});
		});
	}

	private async renderJournalPromptSettings(containerEl: HTMLElement) {
		containerEl.createEl('h3', { text: 'Journal prompts' });

		for (const journal of this.plugin.journals) {
			const promptSettings = this.plugin.getJournalPromptSettings(journal.path);
			const promptStatus = await this.plugin.getPromptSettingsStatus(journal.path);
			const resolvedList = await this.plugin.getResolvedPromptList(journal.path);
			const promptOptions = resolvedList?.prompts ?? [];

			new Setting(containerEl)
				.setName(journal.name)
				.setDesc(promptStatus ?? 'Add prompt rotation, weekday overrides, and prompt delivery behavior for this journal.')
				.addToggle(toggle => {
					toggle.setValue(promptSettings.enabled)
						.onChange(async value => {
							await this.plugin.updateJournalPromptSettings(journal.path, {
								...promptSettings,
								enabled: value,
							});
							this.display();
						});
				})
				.addButton(button => {
					button.setButtonText(this.promptPreviewJournalPath === journal.path ? 'Hide preview' : 'Preview')
						.onClick(() => {
							this.promptPreviewJournalPath = this.promptPreviewJournalPath === journal.path ? null : journal.path;
							this.display();
						});
				});

			if (!promptSettings.enabled) {
				continue;
			}

			new Setting(containerEl)
				.setName(`${journal.name} source`)
				.setDesc('Choose where this journal should pull prompts from.')
				.addDropdown(dropdown => {
					dropdown.addOption('built-in', 'Built-in library');
					dropdown.addOption('custom', 'Custom prompt list');
					dropdown.addOption('file', 'Markdown note');
					dropdown.setValue(promptSettings.sourceType)
						.onChange(async (value: PromptSourceType) => {
							const nextSettings: JournalPromptSettings = {
								...promptSettings,
								sourceType: value,
								selectedListId: value === 'built-in'
									? promptSettings.selectedListId ?? Object.keys(this.plugin.getBuiltInPromptLists())[0]
									: value === 'custom'
										? promptSettings.selectedListId ?? Object.keys(this.plugin.getCustomPromptLists())[0]
										: undefined,
								selectedFilePath: value === 'file' ? promptSettings.selectedFilePath : undefined,
								staticPromptId: undefined,
								weekdayOverrides: {},
							};
							await this.plugin.updateJournalPromptSettings(journal.path, nextSettings);
							this.display();
						});
				});

			if (promptSettings.sourceType === 'built-in' || promptSettings.sourceType === 'custom') {
				const listOptions = promptSettings.sourceType === 'built-in'
					? this.plugin.getBuiltInPromptLists()
					: this.plugin.getCustomPromptLists();

				new Setting(containerEl)
					.setName(`${journal.name} prompt list`)
					.addDropdown(dropdown => {
						Object.values(listOptions).forEach(list => {
							dropdown.addOption(list.id, list.name);
						});

						const defaultListId = promptSettings.selectedListId ?? Object.keys(listOptions)[0] ?? '';
						dropdown.setValue(defaultListId)
							.onChange(async value => {
								await this.plugin.updateJournalPromptSettings(journal.path, {
									...promptSettings,
									selectedListId: value,
									staticPromptId: undefined,
									weekdayOverrides: {},
								});
								this.display();
							});
					});
			}

			if (promptSettings.sourceType === 'file') {
				new Setting(containerEl)
					.setName(`${journal.name} prompt note`)
					.setDesc('Journalyst reads one markdown list item per prompt from the selected note.')
					.addDropdown(dropdown => {
						this.app.vault.getMarkdownFiles().forEach(file => {
							dropdown.addOption(file.path, file.path);
						});

						dropdown.setValue(promptSettings.selectedFilePath ?? '')
							.onChange(async value => {
								await this.plugin.updateJournalPromptSettings(journal.path, {
									...promptSettings,
									selectedFilePath: value || undefined,
									staticPromptId: undefined,
									weekdayOverrides: {},
								});
								this.display();
							});
					});
			}

			new Setting(containerEl)
				.setName(`${journal.name} selection`)
				.addDropdown(dropdown => {
					dropdown.addOption('static', 'Static prompt');
					dropdown.addOption('random', 'Random');
					dropdown.addOption('random-no-repeat', 'Random, no repeats until exhausted');
					dropdown.setValue(promptSettings.selectionMode)
						.onChange(async (value: PromptSelectionMode) => {
							await this.plugin.updateJournalPromptSettings(journal.path, {
								...promptSettings,
								selectionMode: value,
								staticPromptId: value === 'static' ? promptSettings.staticPromptId : undefined,
							});
							this.display();
						});
				})
				.addDropdown(dropdown => {
					dropdown.addOption('append-body', 'Append into note');
					dropdown.addOption('template-variables', 'Use template variables');
					dropdown.setValue(promptSettings.deliveryMode)
						.onChange(async (value: PromptDeliveryMode) => {
							await this.plugin.updateJournalPromptSettings(journal.path, {
								...promptSettings,
								deliveryMode: value,
							});
							this.display();
						});
				});

			if (promptSettings.selectionMode === 'static' && promptOptions.length > 0) {
				new Setting(containerEl)
					.setName(`${journal.name} static prompt`)
					.addDropdown(dropdown => {
						promptOptions.forEach(prompt => {
							dropdown.addOption(prompt.id, prompt.title);
						});

						dropdown.setValue(promptSettings.staticPromptId ?? promptOptions[0]?.id ?? '')
							.onChange(async value => {
								await this.plugin.updateJournalPromptSettings(journal.path, {
									...promptSettings,
									staticPromptId: value,
								});
							});
					});
			}

			if (promptOptions.length > 0) {
				const weekdaysContainer = containerEl.createDiv({ cls: 'journalyst-prompt-weekdays' });
				weekdaysContainer.createEl('span', { text: 'Weekday overrides', cls: 'journalyst-cadence-label' });
				['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach((label, index) => {
					new Setting(weekdaysContainer)
						.setName(label)
						.addDropdown(dropdown => {
							dropdown.addOption('', 'None');
							promptOptions.forEach(prompt => {
								dropdown.addOption(prompt.id, prompt.title);
							});

							dropdown.setValue(promptSettings.weekdayOverrides[index.toString()] ?? '')
								.onChange(async value => {
									const nextOverrides = { ...promptSettings.weekdayOverrides };
									if (value) {
										nextOverrides[index.toString()] = value;
									} else {
										delete nextOverrides[index.toString()];
									}

									await this.plugin.updateJournalPromptSettings(journal.path, {
										...promptSettings,
										weekdayOverrides: nextOverrides,
									});
									this.display();
								});
						});
				});
			}

			if (this.promptPreviewJournalPath === journal.path) {
				const previewPrompts = await this.plugin.getPromptPreview(journal.path, 3);
				const previewContainer = containerEl.createDiv({ cls: 'journalyst-prompt-preview' });
				if (previewPrompts.length === 0) {
					previewContainer.createEl('p', { text: 'No prompts available to preview yet.', cls: 'journalyst-migration-summary' });
				} else {
					previewPrompts.forEach(prompt => {
						previewContainer.createEl('div', { text: prompt.text, cls: 'journalyst-prompt-preview-item' });
					});
				}
			}
		}
	}

	private getCustomPromptListDraft(listId: string, defaultName: string, defaultBody: string) {
		const existingDraft = this.customPromptListDrafts[listId];
		if (existingDraft) {
			return existingDraft;
		}

		const nextDraft = {
			name: defaultName,
			body: defaultBody,
		};
		this.customPromptListDrafts[listId] = nextDraft;
		return nextDraft;
	}

	private renderReviewReminderSetting(
		containerEl: HTMLElement,
		journalPath: string,
		journalName: string,
		reminderSettings: JournalReminderSettings,
		period: ReviewReminderPeriod,
	) {
		const reminder = reminderSettings.reviewReminders[period];
		const description = period === 'weekly'
			? 'Notify once each week to review or synthesize this journal.'
			: period === 'monthly'
				? 'Notify once each month to reflect on this journal.'
				: 'Notify once after each quarter ends to summarize this journal.';
		const label = period === 'weekly'
			? `${journalName} weekly review`
			: period === 'monthly'
				? `${journalName} monthly reflection`
				: `${journalName} quarter summary`;

		new Setting(containerEl)
			.setName(label)
			.setDesc(description)
			.addToggle(toggle => {
				toggle.setValue(reminder.enabled)
					.onChange(async value => {
						await this.plugin.updateJournalReminderSettings(journalPath, {
							...reminderSettings,
							reviewReminders: {
								...reminderSettings.reviewReminders,
								[period]: {
									...reminder,
									enabled: value,
								},
							},
						});
						this.display();
					});
			})
			.addText(text => {
				text.inputEl.type = 'time';
				text.setValue(reminder.time)
					.onChange(async value => {
						await this.plugin.updateJournalReminderSettings(journalPath, {
							...reminderSettings,
							reviewReminders: {
								...reminderSettings.reviewReminders,
								[period]: {
									...reminder,
									time: value,
								},
							},
						});
					});
			})
			.addDropdown(dropdown => {
				this.addReminderDeliveryOptions(dropdown);
				dropdown.setValue(reminder.deliveryMode)
					.onChange(async (value: ReminderDeliveryMode) => {
						await this.plugin.updateJournalReminderSettings(journalPath, {
							...reminderSettings,
							reviewReminders: {
								...reminderSettings.reviewReminders,
								[period]: {
									...reminder,
									deliveryMode: value,
								},
							},
						});
					});
			})
			.addDropdown(dropdown => {
				if (period === 'weekly') {
					const weeklyReminder = reminderSettings.reviewReminders.weekly;
					['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach((labelText, day) => {
						dropdown.addOption(day.toString(), labelText);
					});
					dropdown.setValue(weeklyReminder.weekday.toString())
						.onChange(async value => {
							await this.plugin.updateJournalReminderSettings(journalPath, {
								...reminderSettings,
								reviewReminders: {
									...reminderSettings.reviewReminders,
									weekly: {
										...reminderSettings.reviewReminders.weekly,
										weekday: Number.parseInt(value, 10),
									},
								},
							});
						});
					return;
				}

				if (period === 'monthly') {
					const monthlyReminder = reminderSettings.reviewReminders.monthly;
					for (let day = 1; day <= 28; day += 1) {
						dropdown.addOption(day.toString(), `Day ${day}`);
					}
					dropdown.setValue(monthlyReminder.dayOfMonth.toString())
						.onChange(async value => {
							await this.plugin.updateJournalReminderSettings(journalPath, {
								...reminderSettings,
								reviewReminders: {
									...reminderSettings.reviewReminders,
									monthly: {
										...reminderSettings.reviewReminders.monthly,
										dayOfMonth: Number.parseInt(value, 10),
									},
								},
							});
						});
					return;
				}

				const quarterlyReminder = reminderSettings.reviewReminders.quarterly;
				for (let days = 0; days <= 14; days += 1) {
					dropdown.addOption(days.toString(), days === 0 ? 'Quarter end' : `${days} day${days === 1 ? '' : 's'} after`);
				}
				dropdown.setValue(quarterlyReminder.daysAfterQuarterEnd.toString())
					.onChange(async value => {
						await this.plugin.updateJournalReminderSettings(journalPath, {
							...reminderSettings,
							reviewReminders: {
								...reminderSettings.reviewReminders,
								quarterly: {
									...reminderSettings.reviewReminders.quarterly,
									daysAfterQuarterEnd: Number.parseInt(value, 10),
								},
							},
						});
					});
				});
	}

	private addReminderDeliveryOptions(dropdown: DropdownComponent) {
		dropdown.addOption('in-app', 'In-app');
		dropdown.addOption('os-preferred', 'OS preferred');
	}
}
