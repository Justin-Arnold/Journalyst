<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ReminderJournalModel } from './types';
import ObsidianIcon from '../ObsidianIcon.vue';
import WorkspaceSection from './WorkspaceSection.vue';

type ReminderJournalFilter = 'all' | 'configured' | 'off';

const props = defineProps<{
    journals: ReminderJournalModel[];
    configuredJournalCount: number;
}>();

const emit = defineEmits<{
    editJournal: [journalPath: string];
}>();

const activeFilter = ref<ReminderJournalFilter>('all');
const filters: Array<{ id: ReminderJournalFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'configured', label: 'Configured' },
    { id: 'off', label: 'Off' },
];

const visibleJournals = computed(() => {
    if (activeFilter.value === 'configured') {
        return props.journals.filter(journal => journal.enabledRuleCount > 0);
    }
    if (activeFilter.value === 'off') {
        return props.journals.filter(journal => journal.enabledRuleCount === 0);
    }
    return props.journals;
});

function getStatusLabel(journal: ReminderJournalModel) {
    if (journal.status === 'active') return 'Active';
    if (journal.status === 'global-off') return 'Global off';
    return 'Off';
}

function getRuleIcon(ruleId: ReminderJournalModel['rules'][number]['id']) {
    if (ruleId === 'entry') return 'notebook-pen';
    if (ruleId === 'weekly') return 'calendar-days';
    if (ruleId === 'monthly') return 'calendar-range';
    return 'calendar-clock';
}
</script>

<template>
    <WorkspaceSection
        title="Journal rules"
        :description="`${configuredJournalCount} of ${journals.length} journals have at least one enabled rule.`"
    >
        <div class="journalyst-reminder-journal-toolbar">
            <div class="journalyst-segmented-control" role="group" aria-label="Filter journal reminders">
                <button
                    v-for="filter in filters"
                    :key="filter.id"
                    type="button"
                    :class="{ 'is-active': activeFilter === filter.id }"
                    :aria-pressed="activeFilter === filter.id"
                    @click="activeFilter = filter.id"
                >
                    {{ filter.label }}
                </button>
            </div>
            <span>{{ visibleJournals.length }} shown</span>
        </div>

        <div v-if="visibleJournals.length" class="journalyst-reminder-journal-list">
            <article
                v-for="journal in visibleJournals"
                :key="journal.journalPath"
                class="journalyst-reminder-journal-card"
            >
                <header class="journalyst-reminder-journal-header">
                    <span class="journalyst-reminder-journal-icon" aria-hidden="true">
                        <ObsidianIcon name="notebook" />
                    </span>
                    <span class="journalyst-reminder-journal-identity">
                        <strong>{{ journal.journalName }}</strong>
                        <small>{{ journal.cadenceLabel }}</small>
                    </span>
                    <span class="journalyst-reminder-journal-status" :class="`is-${journal.status}`">
                        {{ getStatusLabel(journal) }}
                    </span>
                    <button
                        type="button"
                        class="journalyst-reminder-edit-action"
                        @click="emit('editJournal', journal.journalPath)"
                    >
                        <ObsidianIcon name="sliders-horizontal" />
                        Edit rules
                    </button>
                </header>

                <div class="journalyst-reminder-rule-summary-grid">
                    <div
                        v-for="rule in journal.rules"
                        :key="rule.id"
                        class="journalyst-reminder-rule-summary"
                        :class="{
                            'is-enabled': rule.enabled,
                            'is-unavailable': !rule.available,
                        }"
                    >
                        <span class="journalyst-reminder-rule-summary-heading">
                            <ObsidianIcon :name="getRuleIcon(rule.id)" />
                            <strong>{{ rule.label }}</strong>
                            <span class="journalyst-reminder-rule-dot" aria-hidden="true" />
                        </span>
                        <span>{{ rule.enabled ? rule.scheduleLabel : rule.available ? 'Off' : rule.scheduleLabel }}</span>
                        <small v-if="rule.enabled">{{ rule.deliveryLabel }}</small>
                    </div>
                </div>
            </article>
        </div>

        <div v-else class="journalyst-reminder-filter-empty">
            <ObsidianIcon name="bell-off" />
            <span>No journals match this filter.</span>
            <button type="button" @click="activeFilter = 'all'">Show all journals</button>
        </div>
    </WorkspaceSection>
</template>

<style scoped>
.journalyst-reminder-journal-toolbar,
.journalyst-reminder-journal-header,
.journalyst-reminder-journal-icon,
.journalyst-reminder-journal-status,
.journalyst-reminder-edit-action,
.journalyst-reminder-rule-summary-heading,
.journalyst-reminder-filter-empty {
    display: flex;
    align-items: center;
}

.journalyst-reminder-journal-toolbar {
    justify-content: space-between;
    gap: var(--size-4-3);
    margin-bottom: var(--size-4-3);
}

.journalyst-reminder-journal-toolbar > span {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
}

.journalyst-segmented-control {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    padding: 2px;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-segmented-control button {
    min-width: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
}

.journalyst-segmented-control button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

.journalyst-segmented-control button[aria-pressed='true'] {
    background: var(--journalyst-accent-dark);
    color: var(--text-on-accent);
}

.journalyst-reminder-journal-list {
    display: grid;
    gap: var(--size-4-3);
}

.journalyst-reminder-journal-card {
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
    container-type: inline-size;
}

.journalyst-reminder-journal-header {
    min-width: 0;
    gap: var(--size-4-3);
    padding: var(--size-4-3) var(--size-4-4);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-reminder-journal-icon {
    width: 2rem;
    height: 2rem;
    flex: 0 0 2rem;
    justify-content: center;
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-accent);
}

.journalyst-reminder-journal-identity {
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--size-4-1);
}

.journalyst-reminder-journal-identity strong,
.journalyst-reminder-journal-identity small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-reminder-journal-identity strong {
    color: var(--text-normal);
    font-size: var(--font-ui-small);
}

.journalyst-reminder-journal-identity small {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
}

.journalyst-reminder-journal-status {
    flex: 0 0 auto;
    padding: var(--size-2-1) var(--size-4-2);
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
}

.journalyst-reminder-journal-status.is-active {
    color: var(--text-success);
}

.journalyst-reminder-journal-status.is-global-off {
    color: var(--text-warning);
}

.journalyst-reminder-edit-action {
    width: auto;
    flex: 0 0 auto;
    gap: var(--size-4-2);
}

.journalyst-reminder-rule-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
}

.journalyst-reminder-rule-summary {
    display: flex;
    min-width: 0;
    min-height: 6.25rem;
    flex-direction: column;
    gap: var(--size-4-2);
    padding: var(--size-4-3) var(--size-4-4);
    color: var(--text-faint);
}

.journalyst-reminder-rule-summary + .journalyst-reminder-rule-summary {
    border-left: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-reminder-rule-summary-heading {
    min-width: 0;
    gap: var(--size-4-2);
    color: var(--text-muted);
}

.journalyst-reminder-rule-summary-heading strong {
    overflow: hidden;
    font-size: var(--font-ui-smaller);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-reminder-rule-dot {
    width: 0.45rem;
    height: 0.45rem;
    margin-left: auto;
    border-radius: 50%;
    background: var(--background-modifier-border);
}

.journalyst-reminder-rule-summary > span:not(.journalyst-reminder-rule-summary-heading) {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    line-height: 1.35;
    overflow-wrap: anywhere;
}

.journalyst-reminder-rule-summary small {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
}

.journalyst-reminder-rule-summary.is-enabled .journalyst-reminder-rule-summary-heading,
.journalyst-reminder-rule-summary.is-enabled > span:not(.journalyst-reminder-rule-summary-heading) {
    color: var(--text-normal);
}

.journalyst-reminder-rule-summary.is-enabled .journalyst-reminder-rule-dot {
    background: var(--interactive-accent);
}

.journalyst-reminder-rule-summary.is-unavailable {
    background: var(--background-primary-alt, var(--background-primary));
}

.journalyst-reminder-filter-empty {
    justify-content: center;
    gap: var(--size-4-3);
    padding: var(--size-4-6);
    border: var(--border-width) dashed var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-muted);
}

.journalyst-reminder-filter-empty button {
    width: auto;
}

button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@container (max-width: 48rem) {
    .journalyst-reminder-rule-summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .journalyst-reminder-rule-summary:nth-child(3) {
        border-top: var(--border-width) solid var(--background-modifier-border);
        border-left: 0;
    }

    .journalyst-reminder-rule-summary:nth-child(4) {
        border-top: var(--border-width) solid var(--background-modifier-border);
    }
}

@container (max-width: 32rem) {
    .journalyst-reminder-journal-toolbar {
        align-items: flex-start;
        flex-direction: column;
    }

    .journalyst-segmented-control {
        width: 100%;
    }

    .journalyst-reminder-journal-header {
        align-items: flex-start;
        flex-wrap: wrap;
    }

    .journalyst-reminder-edit-action {
        margin-left: 2.75rem;
    }

    .journalyst-reminder-rule-summary-grid {
        grid-template-columns: 1fr;
    }

    .journalyst-reminder-rule-summary + .journalyst-reminder-rule-summary,
    .journalyst-reminder-rule-summary:nth-child(4) {
        border-top: var(--border-width) solid var(--background-modifier-border);
        border-left: 0;
    }

    .journalyst-reminder-rule-summary {
        min-height: auto;
    }

    .journalyst-reminder-filter-empty {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
