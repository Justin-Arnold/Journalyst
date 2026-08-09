import { App, Notice, PluginSettingTab, Setting, TFolder } from 'obsidian';
import { type JournalNotePropertyBackfillItem } from "../bases";
import { type SidebarMode } from "../review/types";
import { type TemplateEngine } from "../templates/types";
import JournalystPlugin from "../src/main";

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

		this.renderSectionHeading(containerEl, 'Prompts', 'Manage reusable prompt libraries. Assign prompts to journals from the Journals workspace.');
		this.renderSubsectionIntro(
			containerEl,
			'Prompt libraries',
			'Create custom prompt lists here, or use Journalyst built-in libraries and markdown note-backed lists when you assign prompts to journals.'
		);
		await this.renderCustomPromptLists(containerEl);

		this.renderSectionHeading(containerEl, 'Templates', 'Choose the global template engine and fallback behavior. Assign templates from the Journals workspace.');
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
			.setName('Manage journals')
			.setDesc('Edit journal schedules, entry setup, reminders, integrations, and names in Journalyst.')
			.addButton(button => button
				.setButtonText('Open Journals')
				.setCta()
				.onClick(() => {
					const appWithSettings = this.app as typeof this.app & { setting?: { close(): void } };
					appWithSettings.setting?.close();
					void this.plugin.activateJournalSettings();
				}));

		new Setting(containerEl)
			.setName('Journalyst home directory')
			.setDesc('The directory where Journalyst will look for your journals.')
			.addDropdown(dropdown => {
				const folderPaths = Array.from(new Set([
					'/',
					...this.app.vault.getAllLoadedFiles()
						.filter(file => file instanceof TFolder)
						.map(folder => folder.path),
				]));

				dropdown.addOption('', 'Not configured');
				folderPaths.forEach(folderPath => dropdown.addOption(folderPath, folderPath));

				const configuredRoot = this.plugin.settings.rootDirectory;
				if (configuredRoot && !folderPaths.includes(configuredRoot)) {
					dropdown.addOption(configuredRoot, `${configuredRoot} (missing)`);
				}

				dropdown.setValue(configuredRoot ?? '')
					.onChange(async (value) => {
						const result = await this.plugin.updateRootDirectory(value || null);
						if (!result.ok) {
							new Notice(result.error);
						}
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

	private async renderTemplateSettings(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName('Template engine')
			.setDesc('Choose which template system Journalyst should use when creating journal entries.')
			.addDropdown(dropdown => {
				dropdown.addOption('none', 'None');
				dropdown.addOption('core', 'Obsidian Templates');
				dropdown.addOption('templater', 'Templater');
				dropdown.setValue(this.plugin.settings.templateEngine)
					.onChange(async (value: string) => {
						const castValue = value as TemplateEngine;
						this.plugin.settings.templateEngine = castValue;
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

		const templateAvailability = await this.plugin.getTemplateAvailability(this.plugin.settings.templateEngine);
		const statusText = templateAvailability === 'ready'
			? 'The selected template engine is ready. Template assignments are managed per journal in Journalyst.'
			: templateAvailability === 'not-installed'
				? 'The selected template plugin is not installed.'
				: templateAvailability === 'disabled'
					? 'The selected template plugin is disabled.'
					: 'Configure a template folder before assigning journal templates.';
		this.addTemplateNotice(statusText);
	}

	private addTemplateNotice(message: string) {
		new Setting(this.containerEl)
			.setDesc(message);
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
