<script setup lang="ts">
import { computed } from 'vue';
import moment from 'moment';
import type { YearActivityCell } from '../../../review/types';

const props = defineProps<{
    cells: YearActivityCell[];
}>();

const emit = defineEmits<{
    openNote: [filePath: string];
}>();

type CalendarCell = YearActivityCell | null;

const weeks = computed(() => {
    if (props.cells.length === 0) return [];

    const leadingCells = moment(props.cells[0].date, 'YYYY-MM-DD', true).day();
    const padded: CalendarCell[] = [
        ...Array.from({ length: leadingCells }, () => null),
        ...props.cells,
    ];
    while (padded.length % 7 !== 0) padded.push(null);

    const result: CalendarCell[][] = [];
    for (let index = 0; index < padded.length; index += 7) {
        result.push(padded.slice(index, index + 7));
    }
    return result;
});

const monthLabels = computed(() => weeks.value.map(week => (
    week.find(cell => cell?.dayLabel === '1')?.monthLabel ?? ''
)));

function getStatus(cell: YearActivityCell) {
    if (cell.state === 'complete') return 'Completed entry';
    if (cell.state === 'draft') return 'Unfinished entry';
    if (cell.state === 'missing-expected') return 'Expected entry is missing';
    if (cell.state === 'future') return 'Future date';
    return 'Not scheduled';
}

function getCellLabel(cell: YearActivityCell) {
    const date = moment(cell.date, 'YYYY-MM-DD', true).format('dddd, MMMM D, YYYY');
    const action = cell.filePath ? ' Open entry.' : '';
    return `${date}: ${getStatus(cell)}.${action}`;
}
</script>

<template>
    <div class="journalyst-analytics-year-calendar">
        <div class="journalyst-analytics-year-legend" aria-label="Calendar legend">
            <span><i class="is-complete" />Complete</span>
            <span><i class="is-draft" />Unfinished</span>
            <span><i class="is-missing-expected" />Expected, missing</span>
            <span><i class="is-skipped" />Not scheduled</span>
            <span><i class="is-future" />Future</span>
        </div>

        <div class="journalyst-analytics-year-scroll">
            <div class="journalyst-analytics-year-grid" :style="{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }">
                <div
                    v-for="(label, index) in monthLabels"
                    :key="`month-${index}`"
                    class="journalyst-analytics-year-month"
                >
                    {{ label }}
                </div>

                <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="journalyst-analytics-year-week">
                    <template v-for="(cell, dayIndex) in week" :key="cell?.date ?? `empty-${weekIndex}-${dayIndex}`">
                        <button
                            v-if="cell?.filePath"
                            type="button"
                            class="journalyst-analytics-year-cell"
                            :class="`is-${cell.state}`"
                            :aria-label="getCellLabel(cell)"
                            :title="getCellLabel(cell)"
                            @click="emit('openNote', cell.filePath)"
                        />
                        <span
                            v-else-if="cell"
                            class="journalyst-analytics-year-cell"
                            :class="`is-${cell.state}`"
                            role="img"
                            :aria-label="getCellLabel(cell)"
                            :title="getCellLabel(cell)"
                        />
                        <span v-else class="journalyst-analytics-year-cell is-placeholder" aria-hidden="true" />
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.journalyst-analytics-year-calendar {
    min-width: 0;
}

.journalyst-analytics-year-legend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--size-4-3);
    margin-bottom: var(--size-4-3);
    color: var(--text-faint);
    font-size: var(--journalyst-type-size-supporting);
    flex-wrap: wrap;
}

.journalyst-analytics-year-legend span {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4-1);
}

.journalyst-analytics-year-legend i,
.journalyst-analytics-year-cell {
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: 2px;
}

.journalyst-analytics-year-legend i {
    width: 0.75rem;
    height: 0.75rem;
}

.journalyst-analytics-year-scroll {
    min-width: 0;
    padding: var(--size-4-4);
    overflow-x: auto;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-analytics-year-grid {
    display: grid;
    min-width: 48rem;
    grid-template-rows: 1.25rem auto;
    gap: var(--size-4-1);
}

.journalyst-analytics-year-month {
    min-width: 0;
    overflow: visible;
    color: var(--text-faint);
    font-size: var(--journalyst-type-size-supporting);
    white-space: nowrap;
}

.journalyst-analytics-year-week {
    display: grid;
    min-width: 0;
    grid-template-rows: repeat(7, minmax(0, 1fr));
    gap: 3px;
}

.journalyst-analytics-year-cell {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    min-width: 0;
    min-height: 0;
    padding: 0;
    background: var(--background-primary);
    box-shadow: none;
}

button.journalyst-analytics-year-cell {
    cursor: pointer;
}

.journalyst-analytics-year-cell.is-complete,
.journalyst-analytics-year-legend i.is-complete {
    border-color: var(--interactive-accent);
    background: var(--interactive-accent);
}

.journalyst-analytics-year-cell.is-draft,
.journalyst-analytics-year-legend i.is-draft {
    border-color: var(--text-warning);
    background: var(--background-primary);
}

.journalyst-analytics-year-cell.is-missing-expected,
.journalyst-analytics-year-legend i.is-missing-expected {
    border-color: var(--text-error);
    border-style: dashed;
    background: transparent;
}

.journalyst-analytics-year-cell.is-skipped,
.journalyst-analytics-year-legend i.is-skipped {
    background: transparent;
}

.journalyst-analytics-year-cell.is-future,
.journalyst-analytics-year-legend i.is-future {
    border-color: var(--journalyst-base-recessed);
    background: var(--journalyst-base-recessed);
}

.journalyst-analytics-year-cell.is-placeholder {
    visibility: hidden;
}

button.journalyst-analytics-year-cell:hover {
    border-color: var(--text-accent);
}

button.journalyst-analytics-year-cell:focus-visible {
    position: relative;
    z-index: 1;
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@container (max-width: 34rem) {
    .journalyst-analytics-year-legend {
        justify-content: flex-start;
    }
}
</style>
