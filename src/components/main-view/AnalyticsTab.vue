<script setup lang="ts">
import { computed } from "vue";
import type { JournalAnalyticsSnapshot } from "../../../review/types";
import BarChart from "./BarChart.vue";
import CalloutGrid from "./CalloutGrid.vue";
import WorkspaceOverview from "./WorkspaceOverview.vue";
import WorkspaceSection from "./WorkspaceSection.vue";
import YearCalendar from "./YearCalendar.vue";

const props = defineProps<{
    snapshot: JournalAnalyticsSnapshot;
}>();

const overviewStats = computed(() => [
    { label: 'Cadence', value: props.snapshot.insights.cadenceLabel },
    { label: 'Longest streak', value: props.snapshot.insights.isTracked ? `${props.snapshot.insights.longestStreak}` : 'Off' },
    { label: 'Longest miss', value: props.snapshot.insights.isTracked ? `${props.snapshot.insights.longestMissStretch}` : 'Off' },
    { label: 'Total entries', value: `${props.snapshot.insights.totalEntries}` },
]);
</script>

<template>
    <WorkspaceOverview
        :title="snapshot.journalName"
        :description="`Analytics anchored to ${snapshot.anchor.date}. Compare cadence-aware consistency and writing volume.`"
        :stats="overviewStats"
    />

    <CalloutGrid title="Pattern callouts" :callouts="snapshot.callouts" />

    <WorkspaceSection title="Yearly consistency" description="Expected, completed, and missed days across the current year.">
        <div class="journalyst-review-calendar-surface">
            <YearCalendar :cells="snapshot.yearActivity" />
        </div>
    </WorkspaceSection>

    <WorkspaceSection title="Visuals" description="Consistency and volume over time.">
        <div class="journalyst-review-visual-grid">
            <article class="journalyst-review-visual-card">
                <h3>Weekday rhythm</h3>
                <p class="journalyst-review-meta">Which days you most naturally write on.</p>
                <BarChart :data="snapshot.weekdayDistribution" variant="weekday" />
            </article>
            <article class="journalyst-review-visual-card">
                <h3>Monthly volume</h3>
                <p class="journalyst-review-meta">Entries per month across the last year.</p>
                <BarChart :data="snapshot.monthlyActivity" variant="month" />
            </article>
            <article class="journalyst-review-visual-card journalyst-review-ranked-card">
                <h3>Best and worst periods</h3>
                <p class="journalyst-review-meta">Recent months ranked by cadence-aware completion.</p>
                <dl class="journalyst-ranked-periods">
                    <div>
                        <dt>Best</dt>
                        <dd v-if="snapshot.rankedPeriods.best">
                            {{ snapshot.rankedPeriods.best.label }} ({{ snapshot.rankedPeriods.best.completionRate }}%)
                        </dd>
                        <dd v-else>Not enough history yet</dd>
                    </div>
                    <div>
                        <dt>Worst</dt>
                        <dd v-if="snapshot.rankedPeriods.worst">
                            {{ snapshot.rankedPeriods.worst.label }} ({{ snapshot.rankedPeriods.worst.completionRate }}%)
                        </dd>
                        <dd v-else>Not enough history yet</dd>
                    </div>
                </dl>
            </article>
        </div>
    </WorkspaceSection>

    <WorkspaceSection title="Momentum" description="Compare your current pace with the immediately previous period.">
        <div class="journalyst-review-grid">
            <article v-for="comparison in snapshot.rollingComparisons" :key="comparison.label" class="journalyst-review-card">
                <span class="journalyst-review-label">{{ comparison.label }}</span>
                <strong>{{ comparison.current.completionRate }}%</strong>
                <span class="journalyst-review-meta">Previous: {{ comparison.previous.completionRate }}%</span>
                <span class="journalyst-review-meta">
                    {{ comparison.rateDelta >= 0 ? '+' : '' }}{{ comparison.rateDelta }}% change
                </span>
            </article>
        </div>
    </WorkspaceSection>
</template>
