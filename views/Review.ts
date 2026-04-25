import { ItemView, moment, WorkspaceLeaf } from "obsidian";
import { buildJournalReviewSnapshot } from "../review/buildSnapshot";
import { DistributionDatum, JournalReviewSnapshot, PeriodSummary } from "../review/types";
import JournalystPlugin from "../main";

export const VIEW_TYPE_REVIEW = "journalyst-review-view";

export class ReviewView extends ItemView {
    plugin: JournalystPlugin;
    rootContainer: Element;
    selectedJournalPath: string | null = null;
    anchorDate: string = moment().format('YYYY-MM-DD');

    constructor(leaf: WorkspaceLeaf, plugin: JournalystPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_REVIEW;
    }

    getDisplayText() {
        return "Journalyst Review";
    }

    async onOpen() {
        this.rootContainer = this.containerEl.children[1];
        this.syncStateFromPlugin();
        this.render();

        this.registerEvent(this.app.vault.on('create', () => this.onReviewDataChanged()));
        this.registerEvent(this.app.vault.on('delete', () => this.onReviewDataChanged()));
        this.registerEvent(this.app.vault.on('rename', () => this.onReviewDataChanged()));
        this.registerEvent(this.app.vault.on('modify', () => this.onReviewDataChanged()));
    }

    updateReviewState(journalPath: string | null, anchorDate?: string) {
        this.selectedJournalPath = journalPath;
        this.anchorDate = anchorDate ?? this.anchorDate;
        this.render();
    }

    private onReviewDataChanged() {
        this.plugin.refreshJournals();
        this.syncStateFromPlugin();
        this.render();
    }

    private syncStateFromPlugin() {
        const reviewState = this.plugin.getReviewState();
        this.selectedJournalPath = reviewState.journalPath ?? this.plugin.getDefaultReviewJournalPath();
        this.anchorDate = reviewState.anchorDate;
    }

    private render() {
        this.rootContainer.empty();
        this.rootContainer.addClass('journalyst-review-view');
        this.renderHeader();

        const selectedJournal = this.selectedJournalPath ? this.plugin.getJournalByPath(this.selectedJournalPath) : null;

        if (!selectedJournal) {
            this.renderEmptyState('No journals are available for review yet.');
            return;
        }

        const snapshot = buildJournalReviewSnapshot(selectedJournal, this.anchorDate);
        this.renderOverview(snapshot);
        this.renderVisualizations(snapshot);
        this.renderLookbacks(snapshot);
        this.renderSummaryGrid('Calendar summary', snapshot.calendarSummaries);
        this.renderSummaryGrid('Rolling summary', snapshot.rollingSummaries);
        this.renderInsights(snapshot);
    }

    private renderHeader() {
        const header = this.rootContainer.createEl('div', { cls: 'journalyst-review-header' });
        header.createEl('h3', { text: 'Review' });

        const controls = header.createEl('div', { cls: 'journalyst-review-controls' });

        const journalSelectWrapper = controls.createEl('label', { cls: 'journalyst-review-control' });
        journalSelectWrapper.createEl('span', { text: 'Journal' });
        const journalSelect = journalSelectWrapper.createEl('select');

        this.plugin.journals.forEach(journal => {
            journalSelect.add(new Option(journal.name, journal.path, false, journal.path === this.selectedJournalPath));
        });

        journalSelect.addEventListener('change', async () => {
            this.selectedJournalPath = journalSelect.value || null;
            await this.plugin.setReviewState(this.selectedJournalPath, this.anchorDate);
            this.render();
        });

        const dateInputWrapper = controls.createEl('label', { cls: 'journalyst-review-control' });
        dateInputWrapper.createEl('span', { text: 'Anchor date' });
        const dateInput = dateInputWrapper.createEl('input', {
            attr: {
                type: 'date',
                value: this.anchorDate,
            },
        });

        dateInput.addEventListener('change', async () => {
            this.anchorDate = dateInput.value || moment().format('YYYY-MM-DD');
            await this.plugin.setReviewState(this.selectedJournalPath, this.anchorDate);
            this.render();
        });
    }

    private renderOverview(snapshot: JournalReviewSnapshot) {
        const section = this.rootContainer.createEl('section', { cls: 'journalyst-review-overview' });

        const summary = section.createEl('div', { cls: 'journalyst-review-overview-copy' });
        summary.createEl('h3', { text: snapshot.journalName });
        summary.createEl('p', {
            text: `Review anchored to ${snapshot.anchor.date}. Track consistency, revisit old notes, and spot your journaling rhythm.`,
            cls: 'journalyst-review-section-description',
        });

        const keyStats = section.createEl('div', { cls: 'journalyst-review-overview-stats' });
        [
            { label: 'Entries', value: `${snapshot.insights.totalEntries}` },
            { label: 'Current streak', value: `${snapshot.insights.currentStreak}d` },
            { label: 'Longest streak', value: `${snapshot.insights.longestStreak}d` },
            { label: 'Best rhythm', value: snapshot.insights.busiestWeekday ?? 'Building' },
        ].forEach(stat => {
            const card = keyStats.createEl('div', { cls: 'journalyst-review-stat-pill' });
            card.createEl('span', { text: stat.label, cls: 'journalyst-review-label' });
            card.createEl('strong', { text: stat.value });
        });
    }

    private renderVisualizations(snapshot: JournalReviewSnapshot) {
        const section = this.createSection('Patterns', 'A quick visual read on consistency and rhythm.');
        const grid = section.createEl('div', { cls: 'journalyst-review-visual-grid' });

        const activityCard = grid.createEl('div', { cls: 'journalyst-review-visual-card' });
        activityCard.createEl('h5', { text: 'Recent activity' });
        activityCard.createEl('p', {
            text: 'The last 35 days, read left to right.',
            cls: 'journalyst-review-meta',
        });
        const activityStrip = activityCard.createEl('div', { cls: 'journalyst-review-activity-strip' });

        snapshot.recentActivity.forEach(cell => {
            const cellEl = activityStrip.createEl('div', { cls: 'journalyst-review-activity-cell' });
            if (cell.hasEntry) {
                cellEl.addClass('is-active');
            }
            cellEl.setAttribute('aria-label', `${cell.date}: ${cell.hasEntry ? 'entry written' : 'no entry'}`);
            cellEl.setAttribute('title', `${cell.date}: ${cell.hasEntry ? 'entry written' : 'no entry'}`);
        });

        const weekdayCard = grid.createEl('div', { cls: 'journalyst-review-visual-card' });
        weekdayCard.createEl('h5', { text: 'Weekday rhythm' });
        weekdayCard.createEl('p', {
            text: 'Which days are naturally sticky for this journal.',
            cls: 'journalyst-review-meta',
        });
        this.renderBarChart(weekdayCard, snapshot.weekdayDistribution, 'journalyst-review-bar-chart');

        const monthCard = grid.createEl('div', { cls: 'journalyst-review-visual-card' });
        monthCard.createEl('h5', { text: 'Monthly volume' });
        monthCard.createEl('p', {
            text: 'Entries per month across the last year.',
            cls: 'journalyst-review-meta',
        });
        this.renderBarChart(monthCard, snapshot.monthlyActivity, 'journalyst-review-month-chart');
    }

    private renderLookbacks(snapshot: JournalReviewSnapshot) {
        const section = this.createSection('Lookbacks', 'See what you wrote around this same point in prior periods.');
        const list = section.createEl('div', { cls: 'journalyst-review-list' });

        snapshot.lookbacks.forEach(lookback => {
            const card = list.createEl('button', { cls: 'journalyst-review-lookback' });
            card.type = 'button';
            card.createEl('span', { text: lookback.label, cls: 'journalyst-review-label' });
            card.createEl('strong', { text: lookback.targetDate });

            if (lookback.entry) {
                card.createEl('span', { text: 'Open entry', cls: 'journalyst-review-meta' });
                card.addEventListener('click', () => {
                    void this.openReviewedNote(lookback.entry!.filePath);
                });
            } else {
                card.createEl('span', { text: 'No note for this date yet', cls: 'journalyst-review-empty-text' });
                card.disabled = true;
            }
        });
    }

    private renderSummaryGrid(title: string, summaries: PeriodSummary[]) {
        const section = this.createSection(title);
        const grid = section.createEl('div', { cls: 'journalyst-review-grid' });

        summaries.forEach(summary => {
            const card = grid.createEl('div', { cls: 'journalyst-review-card' });
            card.createEl('span', { text: summary.label, cls: 'journalyst-review-label' });
            const statRow = card.createEl('div', { cls: 'journalyst-review-stat-row' });
            statRow.createEl('strong', { text: `${summary.completedDays}/${summary.totalDays}` });
            statRow.createEl('span', { text: `${summary.completionRate}%`, cls: 'journalyst-review-emphasis' });
            const meter = card.createEl('div', { cls: 'journalyst-review-meter' });
            meter.createEl('div', {
                cls: 'journalyst-review-meter-fill',
                attr: {
                    style: `width: ${summary.completionRate}%`,
                },
            });
            card.createEl('span', { text: `${summary.completionRate}% completion`, cls: 'journalyst-review-meta' });
            card.createEl('span', { text: `${summary.startDate} to ${summary.endDate}`, cls: 'journalyst-review-meta' });
        });
    }

    private renderInsights(snapshot: JournalReviewSnapshot) {
        const section = this.createSection('Insights');
        const grid = section.createEl('div', { cls: 'journalyst-review-grid' });
        const insights = [
            { label: 'Current streak', value: `${snapshot.insights.currentStreak} days` },
            { label: 'Longest streak', value: `${snapshot.insights.longestStreak} days` },
            { label: 'Longest gap', value: snapshot.entryCount < 2 ? 'Not enough history yet' : `${snapshot.insights.longestGapDays} days` },
            { label: 'Total entries', value: `${snapshot.insights.totalEntries}` },
            { label: 'Busiest weekday', value: snapshot.insights.busiestWeekday ?? 'Not enough history yet' },
            { label: 'Busiest month', value: snapshot.insights.busiestMonth ?? 'Not enough history yet' },
        ];

        insights.forEach(insight => {
            const card = grid.createEl('div', { cls: 'journalyst-review-card' });
            card.createEl('span', { text: insight.label, cls: 'journalyst-review-label' });
            card.createEl('strong', { text: insight.value });
        });

        if (snapshot.entryCount < 3) {
            section.createEl('p', {
                text: 'Not enough history yet for deeper patterns, but new entries will immediately improve these review cards.',
                cls: 'journalyst-review-empty-text',
            });
        }
    }

    private createSection(title: string, description?: string) {
        const section = this.rootContainer.createEl('section', { cls: 'journalyst-review-section' });
        section.createEl('h4', { text: title });

        if (description) {
            section.createEl('p', { text: description, cls: 'journalyst-review-section-description' });
        }

        return section;
    }

    private renderEmptyState(message: string) {
        const state = this.rootContainer.createEl('div', { cls: 'journalyst-review-empty' });
        state.createEl('h4', { text: 'Nothing to review yet' });
        state.createEl('p', { text: message });
    }

    private renderBarChart(container: HTMLElement, data: DistributionDatum[], chartClass: string) {
        const chart = container.createEl('div', { cls: chartClass });
        const maxValue = Math.max(...data.map(item => item.value), 1);

        data.forEach(item => {
            const column = chart.createEl('div', { cls: 'journalyst-review-bar-column' });
            const bar = column.createEl('div', { cls: 'journalyst-review-bar' });
            bar.setAttribute('title', `${item.label}: ${item.value}`);
            bar.style.height = `${Math.max(8, (item.value / maxValue) * 100)}%`;
            if (item.value === 0) {
                bar.addClass('is-empty');
            }
            column.createEl('span', { text: item.label, cls: 'journalyst-review-bar-label' });
        });
    }

    private async openReviewedNote(filePath: string) {
        const targetFile = this.app.vault.getFileByPath(filePath);

        if (!targetFile) {
            return;
        }

        const mostRecentLeaf = this.app.workspace.getMostRecentLeaf();

        if (mostRecentLeaf && mostRecentLeaf.view.getViewType() !== VIEW_TYPE_REVIEW) {
            await mostRecentLeaf.openFile(targetFile);
            return;
        }

        const newLeaf = this.app.workspace.getLeaf(true);
        await newLeaf.openFile(targetFile);
    }
}
