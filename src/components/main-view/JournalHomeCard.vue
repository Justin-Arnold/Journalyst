<script setup lang="ts">
import { computed } from "vue";
import type { ReviewWorkspaceTab } from "../../../review/types";
import type {
    JournalHomeCardStatus,
    JournalOverviewData,
} from "../../../review/buildHomeSnapshot";
import ObsidianIcon from "../ObsidianIcon.vue";
import JournalActions from "./JournalActions.vue";
import JournalHeatmap from "./JournalHeatmap.vue";

const props = defineProps<{
    overview: JournalOverviewData;
}>();

const emit = defineEmits<{
    createEntry: [target: { journalPath: string; date?: string }];
    activateTab: [target: { journalPath: string; tab: ReviewWorkspaceTab }];
    editJournal: [journalPath: string];
}>();

function getStatusLabel(status: JournalHomeCardStatus) {
    if (status.kind === 'unfinished-today') return 'Unfinished today';
    if (status.kind === 'due-today') return 'Due today';
    if (status.kind === 'streak') return `${status.count}-day streak`;
    if (status.kind === 'ad-hoc') return 'Ad hoc';
    return 'On track';
}

const statusLabel = computed(() => getStatusLabel(props.overview.cardStatus));

function createEntry(date?: string) {
    emit('createEntry', {
        journalPath: props.overview.journal.path,
        date,
    });
}

function activateTab(tab: ReviewWorkspaceTab) {
    emit('activateTab', {
        journalPath: props.overview.journal.path,
        tab,
    });
}
</script>

<template>
    <article class="journalyst-home-card">
        <header class="journalyst-home-card-header">
            <span class="journalyst-home-card-icon" aria-hidden="true">
                <ObsidianIcon name="notebook-pen" />
            </span>
            <h3 class="journalyst-type-card-title" :title="overview.journal.name">{{ overview.journal.name }}</h3>
            <span
                class="journalyst-home-status-badge journalyst-type-status"
                :class="`is-${overview.cardStatus.kind}`"
            >
                {{ statusLabel }}
            </span>
        </header>

        <dl class="journalyst-home-card-meta">
            <div>
                <dt class="journalyst-type-label">Cadence</dt>
                <dd :title="overview.cadenceLabel">{{ overview.cadenceLabel }}</dd>
            </div>
            <div>
                <dt class="journalyst-type-label">Reminder</dt>
                <dd :title="overview.reminderDisplayText">{{ overview.reminderDisplayText }}</dd>
            </div>
            <div>
                <dt class="journalyst-type-label">Entries</dt>
                <dd>{{ overview.entryCount }}</dd>
            </div>
        </dl>

        <JournalHeatmap
            :days="overview.heatmapDays"
            @select="createEntry"
        />

        <JournalActions
            :journal-name="overview.journal.name"
            :today-exists="!!overview.todayFile"
            :today-is-complete="overview.todayIsComplete"
            :due-today="overview.cardStatus.kind === 'due-today'"
            @today="createEntry()"
            @navigate="activateTab"
            @edit-journal="emit('editJournal', overview.journal.path)"
        />
    </article>
</template>

<style scoped>
.journalyst-home-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 28rem;
    gap: var(--size-4-3);
    padding: var(--size-4-4);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-home-card-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--size-4-3);
    min-height: var(--input-height);
}

.journalyst-home-card-header h3 {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--text-normal);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-home-card-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--input-height);
    height: var(--input-height);
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--interactive-accent);
}

.journalyst-home-status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    max-width: 10rem;
    min-height: 1.6rem;
    padding: 0 var(--size-4-2);
    overflow: hidden;
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-home-status-badge.is-due-today,
.journalyst-home-status-badge.is-unfinished-today {
    color: var(--text-warning);
}

.journalyst-home-status-badge.is-streak {
    color: var(--text-success);
}

.journalyst-home-status-badge.is-on-track {
    color: var(--text-success);
}

.journalyst-home-status-badge.is-ad-hoc {
    color: var(--text-accent);
}

.journalyst-home-card-meta {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 0;
    border-block: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-home-card-meta div {
    min-width: 0;
    padding: var(--size-4-2) var(--size-4-3);
}

.journalyst-home-card-meta div:first-child {
    padding-left: 0;
}

.journalyst-home-card-meta div:last-child {
    padding-right: 0;
}

.journalyst-home-card-meta div + div {
    border-left: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-home-card-meta dt,
.journalyst-home-card-meta dd {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-home-card-meta dt {
    margin-bottom: var(--size-4-1);
    color: var(--text-faint);
}

.journalyst-home-card-meta dd {
    color: var(--text-muted);
    font-size: var(--journalyst-type-size-body);
    font-weight: var(--journalyst-type-weight-body);
}
</style>
