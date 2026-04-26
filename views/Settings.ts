import { App, DropdownComponent, PluginSettingTab, Setting, TFolder } from 'obsidian';
import { JournalNotePropertyBackfillItem } from "../bases";
import { JournalCadenceType } from "../cadence";
import { JournalPromptSettings, PromptDeliveryMode, PromptSelectionMode, PromptSourceType } from "../prompts";
import { SidebarMode } from "../review/types";
import { TemplateEngine } from "../templates/types";
import JournalystPlugin from "../main";

export class JournalystSettingsTab extends PluginSettingTab {
	plugin: JournalystPlugin;
	private noteDateFormatDraft: string | null = null;
	private migrationPreviewFormat: string | null = null;
	private readonly migrationPreviewLimit = 24;
	private customPromptListDrafts: Record<string, { name: string; body: string }> = {};
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
		const { containerEl } = this;
		if (this.noteDateFormatDraft === null) {
			this.noteDateFormatDraft = this.plugin.settings.noteDateFormat;
		}

		const noteDateFormatDraft = this.noteDateFormatDraft;

		containerEl.empty();
		this.plugin.refreshJournals();

		this.renderSectionHeading(containerEl, 'Workspace', 'Choose where Journalyst lives in your vault and how its optional sidebar companion behaves.');
		this.renderWorkspaceSettings(containerEl);

		this.renderSectionHeading(containerEl, 'Notes and files', 'Control how Journalyst names entry files and handles filename migrations.');
		this.renderNoteSettings(containerEl, noteDateFormatDraft);

		this.renderSectionHeading(containerEl, 'Journal cadence', 'Define how often each journal is expected so status, review, and reminders stay honest.');
		this.renderCadenceSettings(containerEl);

		this.renderSectionHeading(containerEl, 'Prompts', 'Keep prompts optional, but use them when you want a little freshness or structure in a journal entry.');
		this.renderSubsectionIntro(
			containerEl,
			'Prompt libraries',
			'Create custom prompt lists here, or use Journalyst built-in libraries and markdown note-backed lists when you assign prompts to journals.'
		);
		await this.renderCustomPromptLists(containerEl);
		this.renderSubsectionIntro(
			containerEl,
			'Journal prompt assignments',
			'Choose which journals use prompts, where those prompts come from, and how Journalyst rotates and delivers them.'
		);
		await this.renderJournalPromptSettings(containerEl);

		this.renderSectionHeading(containerEl, 'Templates', 'Pick the journal template engine, choose fallback behavior, and assign per-journal templates.');
		await this.renderTemplateSettings(containerEl);

		this.renderSectionHeading(containerEl, 'Bases', 'Opt into Journalyst properties and managed starter Bases files for your journals.');
		await this.renderBasesSettings(containerEl);
	}

	private renderSectionHeading(containerEl: HTMLElement, title: string, description?: string) {
		if (containerEl.children.length > 0) {
			containerEl.createEl('hr');
		}

		const section = containerEl.createDiv({ cls: 'journalyst-settings-section' });
		section.createEl('h3', { text: title });

		if (description) {
			section.createEl('p', {
				text: description,
				cls: 'journalyst-settings-section-description',
			});
		}
	}

	private renderSubsectionIntro(containerEl: HTMLElement, title: string, description: string) {
		const section = containerEl.createDiv({ cls: 'journalyst-settings-subsection' });
		section.createEl('h4', { text: title });
		section.createEl('p', {
			text: description,
			cls: 'journalyst-settings-subsection-description',
		});
	}

	private renderWorkspaceSettings(containerEl: HTMLElement) {
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
			.setName('Sidebar mode')
			.setDesc('Choose whether the optional Journalyst sidebar shows a quick home summary or the journal heatmap launcher.')
			.addDropdown(dropdown => {
				dropdown.addOption('home-mini', 'Home mini view');
				dropdown.addOption('journals-mini', 'Journals mini view');
				dropdown.setValue(this.plugin.getSidebarMode())
					.onChange(async value => {
						await this.plugin.updateSidebarMode(value as SidebarMode);
						this.display();
					});
			});
	}

	private renderNoteSettings(containerEl: HTMLElement, noteDateFormatDraft: string) {
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

		if (!this.migrationPreviewFormat) {
			return;
		}

		const migrationPlan = this.plugin.getJournalMigrationPlanForFormat(this.migrationPreviewFormat);
		const conflictingMigrationItems = migrationPlan.filter(item => item.hasConflict);
		const safeMigrationItems = migrationPlan.filter(item => !item.hasConflict);
		const visibleMigrationItems = migrationPlan.slice(0, this.migrationPreviewLimit);
		const hiddenCount = Math.max(0, migrationPlan.length - visibleMigrationItems.length);

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

	private renderCadenceSettings(containerEl: HTMLElement) {
		for (const journal of this.plugin.journals) {
			const cadence = this.plugin.getJournalCadence(journal.path);
			new Setting(containerEl)
				.setName(journal.name)
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
				const detail = containerEl.createDiv({ cls: 'journalyst-cadence-detail' });
				const fieldGrid = detail.createDiv({ cls: 'journalyst-cadence-fields' });

				const intervalField = fieldGrid.createDiv({ cls: 'journalyst-cadence-field' });
				intervalField.createEl('span', { text: 'Every how many days', cls: 'journalyst-cadence-label' });
				const intervalInput = intervalField.createEl('input', { type: 'number' });
				intervalInput.min = '1';
				intervalInput.step = '1';
				intervalInput.value = String(cadence.intervalDays ?? 3);
				intervalInput.addClass('journalyst-cadence-input');
				intervalInput.addEventListener('change', async () => {
					const intervalDays = Math.max(1, Number.parseInt(intervalInput.value, 10) || 1);
					intervalInput.value = String(intervalDays);
					await this.plugin.updateJournalCadence(journal.path, {
						type: 'interval',
						intervalDays,
						startDate: cadence.startDate,
					});
				});

				const anchorField = fieldGrid.createDiv({ cls: 'journalyst-cadence-field' });
				anchorField.createEl('span', { text: 'Anchor date', cls: 'journalyst-cadence-label' });
				const anchorInput = anchorField.createEl('input', { type: 'date' });
				anchorInput.value = cadence.startDate ?? '';
				anchorInput.addClass('journalyst-cadence-input');
				anchorInput.addEventListener('change', async () => {
					await this.plugin.updateJournalCadence(journal.path, {
						type: 'interval',
						intervalDays: cadence.intervalDays ?? 3,
						startDate: anchorInput.value,
					});
				});
			}
		}
	}

	private async renderTemplateSettings(containerEl: HTMLElement) {
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

		if (this.plugin.settings.templateEngine === 'none') {
			this.addTemplateNotice('Journalyst will create entries with its default note content.');
			return;
		}

		await this.renderJournalTemplateSettings(containerEl);
	}

	private addTemplateNotice(message: string) {
		new Setting(this.containerEl)
			.setDesc(message);
	}

	private async renderJournalTemplateSettings(containerEl: HTMLElement) {
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

		this.renderSubsectionIntro(
			containerEl,
			'Journal template assignments',
			'Choose which template file each journal should use when Journalyst creates a new entry.'
		);

		for (const journal of this.plugin.journals) {
			const templatePath = this.plugin.getJournalTemplatePath(templateEngine, journal.path);
			const templateStatus = await this.plugin.getJournalTemplateStatus(templateEngine, journal.path);
			const warningMessage = this.getTemplateWarningMessage(templateStatus, templatePath);

			const setting = new Setting(containerEl)
				.setName(journal.name)
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
				});

			if (warningMessage) {
				setting.setDesc(`Warning: ${warningMessage}.`);
			}
		}
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

	private async renderCustomPromptLists(containerEl: HTMLElement) {
		const customLists = Object.values(this.plugin.getCustomPromptLists());

		new Setting(containerEl)
			.setName('Custom prompt lists')
			.setDesc(customLists.length === 0
				? 'You do not have any custom prompt lists yet.'
				: 'Settings-managed prompt lists use one prompt per line.')
			.addButton(button => {
				button.setButtonText(customLists.length === 0 ? 'Add first list' : 'Add list')
					.setCta()
					.onClick(async () => {
						const listId = this.plugin.createCustomPromptListId();
						await this.plugin.upsertCustomPromptList(listId, 'New Prompt List', '');
						this.customPromptListDrafts[listId] = { name: 'New Prompt List', body: '' };
						this.display();
					});
			});

		if (customLists.length === 0) {
			containerEl.createEl('p', {
				text: 'Built-in prompt libraries are always available when you assign prompts to a journal. Add a custom list here only if you want your own reusable bank.',
				cls: 'journalyst-settings-empty-note',
			});
			return;
		}

		customLists.forEach(list => {
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
		for (const journal of this.plugin.journals) {
			const promptSettings = this.plugin.getJournalPromptSettings(journal.path);
			const promptStatus = await this.plugin.getPromptSettingsStatus(journal.path);
			const resolvedList = await this.plugin.getResolvedPromptList(journal.path);
			const promptOptions = resolvedList?.prompts ?? [];

			const journalSetting = new Setting(containerEl)
				.setName(journal.name)
				.addToggle(toggle => {
					toggle.setValue(promptSettings.enabled)
						.onChange(async value => {
							await this.plugin.updateJournalPromptSettings(journal.path, {
								...promptSettings,
								enabled: value,
							});
							this.display();
						});
				});

			if (promptStatus) {
				journalSetting.setDesc(promptStatus);
			}

			if (!promptSettings.enabled) {
				continue;
			}

			const detailsContainer = containerEl.createDiv({ cls: 'journalyst-prompt-journal-details' });

			new Setting(detailsContainer)
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

				new Setting(detailsContainer)
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
				new Setting(detailsContainer)
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

			new Setting(detailsContainer)
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
				new Setting(detailsContainer)
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
				const weekdaysContainer = detailsContainer.createDiv({ cls: 'journalyst-prompt-weekdays' });
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

}
