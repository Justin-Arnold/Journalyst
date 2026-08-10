<script setup lang="ts">
import { computed, ref } from 'vue';
import moment from 'moment';
import type { ReviewActivityCell } from '../../../review/types';
import WorkspaceSection from './WorkspaceSection.vue';

const props = defineProps<{
    cells: ReviewActivityCell[];
}>();

const emit = defineEmits<{
    openNote: [filePath: string];
}>();

const ranges = [
    { label: '2W', days: 14 as const },
    { label: '4W', days: 28 as const },
    { label: '12W', days: 84 as const },
];
const selectedDays = ref<14 | 28 | 84>(28);
const visibleCells = computed(() => props.cells.slice(-selectedDays.value));

function getStatus(cell: ReviewActivityCell) {
    if (cell.state === 'complete') return 'Completed entry';
    if (cell.state === 'draft') return 'Unfinished entry';
    if (cell.state === 'due') return 'Expected today, not started';
    if (cell.state === 'missing-expected') return 'Expected entry is missing';
    if (cell.state === 'future') return 'Future date';
    return 'Not scheduled';
}

function getCellLabel(cell: ReviewActivityCell) {
    const date = moment(cell.date, 'YYYY-MM-DD', true).format('dddd, MMMM D, YYYY');
    const anchor = cell.isAnchor ? ' Review anchor.' : '';
    const action = cell.filePath ? ' Open entry.' : '';
    return `${date}: ${getStatus(cell)}.${anchor}${action}`;
}
</script>

<template>
    <WorkspaceSection title="Recent activity" description="Your journal activity leading up to the anchor date.">
        <template #default>
            <div class="journalyst-review-activity-container">
                <div class="journalyst-review-activity-toolbar">
                    <div class="journalyst-review-range-control" role="group" aria-label="Activity range">
                        <button
                            v-for="range in ranges"
                            :key="range.days"
                            type="button"
                            :class="{ 'is-active': selectedDays === range.days }"
                            :aria-pressed="selectedDays === range.days"
                            @click="selectedDays = range.days"
                        >
                            {{ range.label }}
                        </button>
                    </div>
                </div>

                <div class="journalyst-review-activity-surface" aria-label="Recent journal activity">
                    <div class="journalyst-review-activity-grid">
                        <template v-for="cell in visibleCells" :key="cell.date">
                            <button
                                v-if="cell.filePath"
                                type="button"
                                class="journalyst-review-activity-day"
                                :class="[`is-${cell.state}`, { 'is-anchor': cell.isAnchor }]"
                                :aria-label="getCellLabel(cell)"
                                :title="getCellLabel(cell)"
                                @click="emit('openNote', cell.filePath)"
                            >
                                <strong>{{ moment(cell.date).format('D') }}</strong>
                                <span>{{ moment(cell.date).format('dd').slice(0, 1) }}</span>
                            </button>
                            <span
                                v-else
                                class="journalyst-review-activity-day"
                                :class="[`is-${cell.state}`, { 'is-anchor': cell.isAnchor }]"
                                :aria-label="getCellLabel(cell)"
                                :title="getCellLabel(cell)"
                            >
                                <strong>{{ moment(cell.date).format('D') }}</strong>
                                <span>{{ moment(cell.date).format('dd').slice(0, 1) }}</span>
                            </span>
                        </template>
                    </div>
                </div>
            </div>
        </template>
    </WorkspaceSection>
</template>

<style scoped>
.journalyst-review-activity-container {
    min-width: 0;
    container-type: inline-size;
}

.journalyst-review-activity-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-top: calc(-1 * (var(--input-height) + var(--size-4-3)));
    margin-bottom: var(--size-4-3);
}

.journalyst-review-range-control {
    display: inline-flex;
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-review-range-control button {
    width: auto;
    min-width: 3rem;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
}

.journalyst-review-range-control button + button {
    border-left: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-review-range-control button.is-active {
    background: var(--background-modifier-hover);
    color: var(--text-accent);
}

.journalyst-review-range-control button:focus-visible {
    position: relative;
    z-index: 1;
    outline: 2px solid var(--interactive-accent);
    outline-offset: -2px;
}

.journalyst-review-activity-surface {
    min-width: 0;
    padding: var(--size-4-3);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-review-activity-grid {
    display: grid;
    grid-template-columns: repeat(14, minmax(0, 1fr));
    gap: var(--size-4-1);
}

.journalyst-review-activity-day {
    display: flex;
    aspect-ratio: 0.92;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--size-2-1);
    padding: var(--size-4-1);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: 3px;
    background: var(--background-primary);
    box-shadow: none;
    color: var(--text-muted);
    line-height: 1;
}

button.journalyst-review-activity-day {
    height: auto;
    cursor: pointer;
}

.journalyst-review-activity-day strong {
    font-size: var(--font-ui-small);
    font-weight: 600;
}

.journalyst-review-activity-day span {
    color: currentColor;
    font-size: var(--font-ui-smaller);
    opacity: 0.7;
}

.journalyst-review-activity-day.is-complete {
    border-color: var(--interactive-accent);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.journalyst-review-activity-day.is-draft {
    border-color: var(--text-warning);
    background: var(--background-primary);
    color: var(--text-warning);
}

.journalyst-review-activity-day.is-due {
    border-style: dashed;
    border-color: var(--text-warning);
    background: transparent;
    color: var(--text-warning);
}

.journalyst-review-activity-day.is-missing-expected {
    border-style: dashed;
    border-color: var(--text-error);
    background: transparent;
    color: var(--text-muted);
}

.journalyst-review-activity-day.is-skipped {
    background: transparent;
    color: var(--text-faint);
}

.journalyst-review-activity-day.is-future {
    border-color: var(--journalyst-base-recessed);
    background: transparent;
    color: var(--text-faint);
    opacity: 0.48;
}

.journalyst-review-activity-day.is-anchor {
    box-shadow: 0 0 0 2px var(--journalyst-base-recessed), 0 0 0 4px var(--interactive-accent);
}

button.journalyst-review-activity-day:hover {
    border-color: var(--interactive-accent);
    color: var(--text-normal);
}

button.journalyst-review-activity-day.is-complete:hover {
    color: var(--text-on-accent);
}

button.journalyst-review-activity-day:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@container (max-width: 48rem) {
    .journalyst-review-activity-toolbar {
        margin-top: 0;
    }

    .journalyst-review-activity-grid {
        grid-template-columns: repeat(7, minmax(0, 1fr));
    }
}
</style>
