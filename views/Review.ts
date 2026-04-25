import { ItemView, moment, normalizePath, WorkspaceLeaf } from "obsidian";
import {
    buildJournalAnalyticsSnapshot,
    buildJournalReviewSnapshot,
    buildSynthesisNotePreview,
} from "../review/buildSnapshot";
import {
    AnalyticsCallout,
    DistributionDatum,
    JournalAnalyticsSnapshot,
    JournalReviewSnapshot,
    PeriodSummary,
    RankedPeriod,
    ReviewWorkspaceTab,
    SynthesisNotePreview,
    SynthesisPeriodType,
    YearActivityCell,
} from "../review/types";
import { buildJournalHomeSummary, buildJournalOverviewData, renderJournalActionButtons, renderJournalHeatmap } from "./journalUi";
import JournalystPlugin from "../main";

export const VIEW_TYPE_REVIEW = "journalyst-review-view";

export class ReviewView extends ItemView {
    plugin: JournalystPlugin;
    rootContainer: Element;
    selectedJournalPath: string | null = null;
    anchorDate: string = moment().format('YYYY-MM-DD');
    activeTab: ReviewWorkspaceTab = 'review';

    constructor(leaf: WorkspaceLeaf, plugin: JournalystPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_REVIEW;
    }

    getDisplayText() {
        return "Journalyst";
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

    updateReviewState(journalPath: string | null, anchorDate?: string, activeTab?: ReviewWorkspaceTab) {
        this.selectedJournalPath = journalPath;
        this.anchorDate = anchorDate ?? this.anchorDate;
        this.activeTab = activeTab ?? this.activeTab;
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
        this.activeTab = reviewState.activeTab;
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

        const reviewSnapshot = buildJournalReviewSnapshot(selectedJournal, this.anchorDate, this.plugin.settings);
        const analyticsSnapshot = buildJournalAnalyticsSnapshot(selectedJournal, this.anchorDate, this.plugin.settings);
        const synthesisPreviews = (['weekly', 'monthly', 'quarterly'] as SynthesisPeriodType[]).map(periodType =>
            buildSynthesisNotePreview(selectedJournal, this.anchorDate, this.plugin.settings, periodType)
        );

        if (this.activeTab === 'home') {
            this.renderHomeTab();
            return;
        }

        if (this.activeTab === 'analytics') {
            this.renderAnalyticsTab(analyticsSnapshot);
            return;
        }

        if (this.activeTab === 'synthesis') {
            this.renderSynthesisTab(selectedJournal.path, synthesisPreviews);
            return;
        }

        this.renderReviewTab(reviewSnapshot);
    }

    private renderHeader() {
        const header = this.rootContainer.createEl('div', { cls: 'journalyst-review-header' });
        header.createEl('h3', { text: 'Journalyst' });

        if (this.activeTab !== 'home') {
            const controls = header.createEl('div', { cls: 'journalyst-review-controls' });

            const journalSelectWrapper = controls.createEl('label', { cls: 'journalyst-review-control' });
            journalSelectWrapper.createEl('span', { text: 'Journal' });
            const journalSelect = journalSelectWrapper.createEl('select');

            this.plugin.journals.forEach(journal => {
                journalSelect.add(new Option(journal.name, journal.path, false, journal.path === this.selectedJournalPath));
            });

            journalSelect.addEventListener('change', async () => {
                this.selectedJournalPath = journalSelect.value || null;
                await this.plugin.setReviewState(this.selectedJournalPath, this.anchorDate, this.activeTab);
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
                await this.plugin.setReviewState(this.selectedJournalPath, this.anchorDate, this.activeTab);
                this.render();
            });
        }

        const tabs = this.rootContainer.createEl('div', { cls: 'journalyst-review-tabs' });
        this.renderTabButton(tabs, 'home', 'Home');
        this.renderTabButton(tabs, 'review', 'Review');
        this.renderTabButton(tabs, 'analytics', 'Analytics');
        this.renderTabButton(tabs, 'synthesis', 'Synthesis');
    }

    private renderTabButton(container: HTMLElement, tab: ReviewWorkspaceTab, label: string) {
        const button = container.createEl('button', {
            cls: 'journalyst-review-tab',
            text: label,
        });
        button.type = 'button';
        if (this.activeTab === tab) {
            button.addClass('is-active');
        }
        button.addEventListener('click', async () => {
            this.activeTab = tab;
            await this.plugin.setReviewState(this.selectedJournalPath, this.anchorDate, tab);
            this.render();
        });
    }

    private renderReviewTab(snapshot: JournalReviewSnapshot) {
        this.renderOverview(snapshot.journalName, snapshot.anchor.date, [
            { label: 'Cadence', value: snapshot.insights.cadenceLabel },
            { label: 'Current streak', value: snapshot.insights.isTracked ? `${snapshot.insights.currentStreak}` : 'Off' },
            { label: 'Missed now', value: snapshot.insights.isTracked ? `${snapshot.insights.outstandingMisses}` : 'Off' },
            { label: 'Next expected', value: snapshot.insights.nextExpectedDate ?? 'Flexible' },
        ]);

        this.renderCallouts('Highlights', snapshot.reviewCallouts);
        this.renderLookbacks(snapshot);
        this.renderRecentActivity(snapshot);
        this.renderSummaryGrid('Calendar summary', snapshot.calendarSummaries);
        this.renderSummaryGrid('Rolling summary', snapshot.rollingSummaries);
        this.renderInsights(snapshot);
    }

    private renderHomeTab() {
        const summary = buildJournalHomeSummary(this.plugin);
        this.renderOverview('Home', moment().format('YYYY-MM-DD'), [
            { label: 'Journals', value: `${summary.totalJournals}` },
            { label: 'Due now', value: `${summary.dueTodayCount}` },
            { label: 'Missed', value: `${summary.missedCount}` },
            { label: 'Reminders active', value: `${summary.remindersActiveCount}` },
        ], [
            {
                label: 'Open sidebar',
                onClick: () => {
                    void this.plugin.activateSidebarView();
                },
            },
            {
                label: 'Sidebar: Home',
                onClick: () => {
                    void this.plugin.activateSidebarView('home-mini');
                },
            },
            {
                label: 'Sidebar: Journals',
                onClick: () => {
                    void this.plugin.activateSidebarView('journals-mini');
                },
            },
        ]);

        const urgentCallouts: AnalyticsCallout[] = [];
        if (summary.dueTodayCount > 0) {
            urgentCallouts.push({
                title: 'Due today',
                body: `${summary.dueTodayCount} journal${summary.dueTodayCount === 1 ? '' : 's'} need attention today.`,
            });
        }
        if (summary.missedCount > 0) {
            urgentCallouts.push({
                title: 'Misses to revisit',
                body: `${summary.missedCount} missed expected entries are still outstanding.`,
            });
        }
        if (summary.remindersActiveCount > 0) {
            urgentCallouts.push({
                title: 'Reminders running',
                body: `${summary.remindersActiveCount} journal${summary.remindersActiveCount === 1 ? '' : 's'} have active reminder rules.`,
            });
        }

        if (urgentCallouts.length > 0) {
            this.renderCallouts('Right now', urgentCallouts);
        }

        const section = this.createSection('Journals', 'Quick-create, glance at this month, and jump into deeper review when you need it.');
        const grid = section.createEl('div', { cls: 'journalyst-home-grid' });

        this.plugin.journals.forEach(journal => {
            const overview = buildJournalOverviewData(this.plugin, journal);
            const card = grid.createEl('div', { cls: 'journalyst-home-card' });
            const topRow = card.createEl('div', { cls: 'journalyst-home-card-header' });
            topRow.createEl('h4', { text: journal.name });
            const badge = topRow.createEl('span', { cls: 'journalyst-home-status-badge', text: overview.cadenceStatusText });
            if (overview.dueToday) {
                badge.addClass('is-due');
            } else if (overview.outstandingMisses > 0) {
                badge.addClass('is-missed');
            }

            const meta = card.createEl('div', { cls: 'journalyst-home-card-meta' });
            meta.createEl('span', { text: overview.cadenceLabel, cls: 'journalyst-review-meta' });
            meta.createEl('span', { text: overview.reminderStatusText, cls: 'journalyst-review-meta' });

            renderJournalHeatmap(card, overview, (date) => {
                void this.plugin.createJournalEntry(journal, date);
            });
            renderJournalActionButtons(card, this.plugin, overview, { includeSynthesis: true });
        });
    }

    private renderAnalyticsTab(snapshot: JournalAnalyticsSnapshot) {
        this.renderOverview(snapshot.journalName, snapshot.anchor.date, [
            { label: 'Cadence', value: snapshot.insights.cadenceLabel },
            { label: 'Longest streak', value: snapshot.insights.isTracked ? `${snapshot.insights.longestStreak}` : 'Off' },
            { label: 'Longest miss', value: snapshot.insights.isTracked ? `${snapshot.insights.longestMissStretch}` : 'Off' },
            { label: 'Total entries', value: `${snapshot.insights.totalEntries}` },
        ]);

        this.renderCallouts('Pattern callouts', snapshot.callouts);
        this.renderYearCalendar(snapshot.yearActivity);

        const chartsSection = this.createSection('Visuals', 'Consistency and volume over time.');
        const grid = chartsSection.createEl('div', { cls: 'journalyst-review-visual-grid' });

        const weekdayCard = grid.createEl('div', { cls: 'journalyst-review-visual-card' });
        weekdayCard.createEl('h5', { text: 'Weekday rhythm' });
        weekdayCard.createEl('p', { text: 'Which days you most naturally write on.', cls: 'journalyst-review-meta' });
        this.renderBarChart(weekdayCard, snapshot.weekdayDistribution, 'journalyst-review-bar-chart');

        const monthCard = grid.createEl('div', { cls: 'journalyst-review-visual-card' });
        monthCard.createEl('h5', { text: 'Monthly volume' });
        monthCard.createEl('p', { text: 'Entries per month across the last year.', cls: 'journalyst-review-meta' });
        this.renderBarChart(monthCard, snapshot.monthlyActivity, 'journalyst-review-month-chart');

        const rankedCard = grid.createEl('div', { cls: 'journalyst-review-visual-card' });
        rankedCard.createEl('h5', { text: 'Best and worst periods' });
        rankedCard.createEl('p', { text: 'Recent months ranked by cadence-aware completion.', cls: 'journalyst-review-meta' });
        this.renderRankedPeriods(rankedCard, snapshot.rankedPeriods.best, snapshot.rankedPeriods.worst);

        this.renderRollingComparisons(snapshot.rollingComparisons);
    }

    private renderSynthesisTab(journalPath: string, previews: SynthesisNotePreview[]) {
        const section = this.createSection('Synthesis', 'Turn the current review period into a structured reflection note.');
        const grid = section.createEl('div', { cls: 'journalyst-review-grid' });

        previews.forEach(preview => {
            const card = grid.createEl('div', { cls: 'journalyst-review-card journalyst-synthesis-card' });
            card.createEl('span', { text: preview.periodType, cls: 'journalyst-review-label' });
            card.createEl('strong', { text: preview.title });
            card.createEl('span', { text: `${preview.startDate} to ${preview.endDate}`, cls: 'journalyst-review-meta' });
            card.createEl('span', {
                text: preview.summary.tracked
                    ? `${preview.summary.completedDays}/${preview.summary.totalDays} expected entries (${preview.summary.completionRate}%)`
                    : 'Ad hoc journal; completion is not scored.',
                cls: 'journalyst-review-meta',
            });

            const notable = card.createEl('div', { cls: 'journalyst-synthesis-list' });
            notable.createEl('span', { text: 'Notable entries', cls: 'journalyst-review-label' });
            if (preview.notableEntries.length === 0) {
                notable.createEl('span', { text: 'No entries in this period yet.', cls: 'journalyst-review-meta' });
            } else {
                preview.notableEntries.forEach(entry => {
                    const button = notable.createEl('button', { cls: 'journalyst-synthesis-link', text: entry.displayLabel });
                    button.type = 'button';
                    button.addEventListener('click', () => {
                        void this.openReviewedNote(entry.filePath);
                    });
                });
            }

            const prompts = card.createEl('div', { cls: 'journalyst-synthesis-list' });
            prompts.createEl('span', { text: 'Reflection prompts', cls: 'journalyst-review-label' });
            preview.reflectionPrompts.forEach(prompt => {
                prompts.createEl('div', { text: prompt, cls: 'journalyst-review-meta' });
            });

            const filePath = normalizePath(`${journalPath}/${preview.fileName}`);
            const existingFile = this.app.vault.getFileByPath(filePath);
            const action = card.createEl('button', {
                cls: 'mod-cta',
                text: existingFile ? 'Open note' : 'Create note',
            });
            action.type = 'button';
            action.addEventListener('click', () => {
                void this.plugin.createSynthesisNote(journalPath, this.anchorDate, preview.periodType);
            });
        });
    }

    private renderOverview(
        journalName: string,
        anchorDate: string,
        stats: Array<{ label: string; value: string }>,
        actions?: Array<{ label: string; onClick: () => void }>,
    ) {
        const section = this.rootContainer.createEl('section', { cls: 'journalyst-review-overview' });
        const summary = section.createEl('div', { cls: 'journalyst-review-overview-copy' });
        summary.createEl('h3', { text: journalName });
        summary.createEl('p', {
            text: `Review anchored to ${anchorDate}. Track consistency, revisit old notes, and turn patterns into reflection.`,
            cls: 'journalyst-review-section-description',
        });

        if (actions && actions.length > 0) {
            const actionRow = summary.createEl('div', { cls: 'journalyst-review-overview-actions' });
            actions.forEach(action => {
                const button = actionRow.createEl('button', { text: action.label, cls: 'journal-section-button' });
                button.type = 'button';
                button.addEventListener('click', action.onClick);
            });
        }

        const keyStats = section.createEl('div', { cls: 'journalyst-review-overview-stats' });
        stats.forEach(stat => {
            const card = keyStats.createEl('div', { cls: 'journalyst-review-stat-pill' });
            card.createEl('span', { text: stat.label, cls: 'journalyst-review-label' });
            card.createEl('strong', { text: stat.value });
        });
    }

    private renderCallouts(title: string, callouts: AnalyticsCallout[]) {
        if (callouts.length === 0) {
            return;
        }

        const section = this.createSection(title);
        const grid = section.createEl('div', { cls: 'journalyst-review-grid' });
        callouts.forEach(callout => {
            const card = grid.createEl('div', { cls: 'journalyst-review-card' });
            card.createEl('span', { text: callout.title, cls: 'journalyst-review-label' });
            card.createEl('strong', { text: callout.body });
        });
    }

    private renderRecentActivity(snapshot: JournalReviewSnapshot) {
        const section = this.createSection('Recent activity', 'A quick read on the last 35 days.');
        const card = section.createEl('div', { cls: 'journalyst-review-card' });
        const strip = card.createEl('div', { cls: 'journalyst-review-activity-strip' });

        snapshot.recentActivity.forEach(cell => {
            const cellEl = strip.createEl('div', { cls: 'journalyst-review-activity-cell' });
            if (cell.hasEntry) {
                cellEl.addClass('is-active');
            } else if (cell.isExpected) {
                cellEl.addClass('is-missed');
            }
            const status = cell.hasEntry ? 'entry written' : cell.isExpected ? 'expected but missed' : 'not expected';
            cellEl.setAttribute('aria-label', `${cell.date}: ${status}`);
            cellEl.setAttribute('title', `${cell.date}: ${status}`);
        });
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
            if (summary.tracked) {
                const statRow = card.createEl('div', { cls: 'journalyst-review-stat-row' });
                statRow.createEl('strong', { text: `${summary.completedDays}/${summary.totalDays}` });
                statRow.createEl('span', { text: `${summary.completionRate}%`, cls: 'journalyst-review-emphasis' });
                const meter = card.createEl('div', { cls: 'journalyst-review-meter' });
                meter.createEl('div', {
                    cls: 'journalyst-review-meter-fill',
                    attr: { style: `width: ${summary.completionRate}%` },
                });
                card.createEl('span', { text: `${summary.completionRate}% of expected entries`, cls: 'journalyst-review-meta' });
            } else {
                card.createEl('strong', { text: 'Not tracked' });
                card.createEl('span', { text: 'This journal uses an ad hoc cadence, so completion is not scored.', cls: 'journalyst-review-meta' });
            }
            card.createEl('span', { text: `${summary.startDate} to ${summary.endDate}`, cls: 'journalyst-review-meta' });
        });
    }

    private renderInsights(snapshot: JournalReviewSnapshot) {
        const section = this.createSection('Insights');
        const grid = section.createEl('div', { cls: 'journalyst-review-grid' });
        const insights = [
            { label: 'Current streak', value: snapshot.insights.isTracked ? `${snapshot.insights.currentStreak} expected hits` : 'Not tracked' },
            { label: 'Longest streak', value: snapshot.insights.isTracked ? `${snapshot.insights.longestStreak} expected hits` : 'Not tracked' },
            { label: 'Longest miss stretch', value: snapshot.insights.isTracked ? `${snapshot.insights.longestMissStretch} misses` : 'Not tracked' },
            { label: 'Total entries', value: `${snapshot.insights.totalEntries}` },
            { label: 'Expected today', value: snapshot.insights.isTracked ? (snapshot.insights.expectedToday ? 'Yes' : 'No') : 'Flexible' },
            { label: 'Outstanding misses', value: snapshot.insights.isTracked ? `${snapshot.insights.outstandingMisses}` : 'Flexible' },
        ];

        insights.forEach(insight => {
            const card = grid.createEl('div', { cls: 'journalyst-review-card' });
            card.createEl('span', { text: insight.label, cls: 'journalyst-review-label' });
            card.createEl('strong', { text: insight.value });
        });
    }

    private renderYearCalendar(cells: YearActivityCell[]) {
        const section = this.createSection('Yearly consistency', 'Expected, completed, and missed days across the current year.');
        const calendar = section.createEl('div', { cls: 'journalyst-review-year-calendar' });
        const weeks = this.chunkIntoWeeks(cells);

        weeks.forEach(week => {
            const weekColumn = calendar.createEl('div', { cls: 'journalyst-review-year-week' });
            week.forEach(cell => {
                const cellEl = weekColumn.createEl('div', { cls: 'journalyst-review-year-cell' });
                if (cell.hasEntry) {
                    cellEl.addClass('is-active');
                } else if (cell.isExpected && !cell.isFuture) {
                    cellEl.addClass('is-missed');
                } else if (cell.isFuture) {
                    cellEl.addClass('is-future');
                }
                cellEl.setAttribute('title', `${cell.date}: ${cell.hasEntry ? 'entry written' : cell.isExpected ? 'expected but missed' : cell.isFuture ? 'future day' : 'not expected'}`);
            });
        });
    }

    private renderRollingComparisons(comparisons: import("../review/types").RollingComparison[]) {
        const section = this.createSection('Momentum', 'Compare your current pace with the immediately previous period.');
        const grid = section.createEl('div', { cls: 'journalyst-review-grid' });

        comparisons.forEach(comparison => {
            const card = grid.createEl('div', { cls: 'journalyst-review-card' });
            card.createEl('span', { text: comparison.label, cls: 'journalyst-review-label' });
            card.createEl('strong', { text: `${comparison.current.completionRate}%` });
            card.createEl('span', { text: `Previous: ${comparison.previous.completionRate}%`, cls: 'journalyst-review-meta' });
            card.createEl('span', {
                text: `${comparison.rateDelta >= 0 ? '+' : ''}${comparison.rateDelta}% change`,
                cls: 'journalyst-review-meta',
            });
        });
    }

    private renderRankedPeriods(container: HTMLElement, best: RankedPeriod | null, worst: RankedPeriod | null) {
        const list = container.createEl('div', { cls: 'journalyst-synthesis-list' });

        const renderPeriod = (label: string, period: RankedPeriod | null) => {
            const row = list.createEl('div', { cls: 'journalyst-review-meta' });
            row.textContent = period
                ? `${label}: ${period.label} (${period.completionRate}%)`
                : `${label}: not enough history yet`;
        };

        renderPeriod('Best', best);
        renderPeriod('Worst', worst);
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

    private chunkIntoWeeks<T>(items: T[]) {
        const chunks: T[][] = [];
        for (let index = 0; index < items.length; index += 7) {
            chunks.push(items.slice(index, index + 7));
        }
        return chunks;
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
