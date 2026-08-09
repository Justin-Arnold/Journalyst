<script setup lang="ts">
import { computed } from "vue";
import moment from "moment";
import type { JournalHeatmapDay } from "../../../review/buildHomeSnapshot";

const props = defineProps<{
    days: JournalHeatmapDay[];
}>();

defineEmits<{
    select: [date: string];
}>();

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const leadingCellCount = computed(() => {
    const firstDate = props.days[0]?.date;
    return firstDate ? moment(firstDate, 'YYYY-MM-DD', true).day() : 0;
});
const trailingCellCount = computed(() => Math.max(
    0,
    42 - leadingCellCount.value - props.days.length,
));

function getActionLabel(day: JournalHeatmapDay) {
    if (day.isComplete) return 'Open completed journal entry';
    if (day.hasEntry) return 'Open unfinished journal entry';
    return 'Create journal entry';
}

function getStateLabel(day: JournalHeatmapDay) {
    if (day.state === 'complete') return 'Completed';
    if (day.state === 'draft') return 'Unfinished';
    if (day.state === 'due-today') return 'Due today, not started';
    if (day.state === 'unfinished-today') return 'Due today, unfinished';
    if (day.state === 'missing-expected') return 'Expected entry is missing';
    if (day.state === 'skipped') {
        return day.isBeforeTrackingStart ? 'Before journal started' : 'Not scheduled';
    }
    if (day.state === 'future') return 'Future date';
    return day.isToday && day.isExpected ? 'Expected today' : 'No entry';
}

function getDayLabel(day: JournalHeatmapDay) {
    return `${day.date}: ${getStateLabel(day)}. ${getActionLabel(day)}.`;
}
</script>

<template>
    <div class="journalyst-card-calendar" role="group" aria-label="Current month entries">
        <span
            v-for="(label, index) in weekdayLabels"
            :key="`${label}-${index}`"
            class="journalyst-card-calendar-label"
            aria-hidden="true"
        >
            {{ label }}
        </span>
        <span
            v-for="index in leadingCellCount"
            :key="`leading-${index}`"
            class="journalyst-card-calendar-blank"
            aria-hidden="true"
        />
        <button
            v-for="day in days"
            :key="day.date"
            type="button"
            class="journalyst-card-calendar-day"
            :class="`is-${day.state}`"
            :aria-label="getDayLabel(day)"
            :title="getDayLabel(day)"
            @click="$emit('select', day.date)"
        >
            {{ day.dayNumber }}
        </button>
        <span
            v-for="index in trailingCellCount"
            :key="`trailing-${index}`"
            class="journalyst-card-calendar-blank"
            aria-hidden="true"
        />
    </div>
</template>

<style scoped>
.journalyst-card-calendar {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    align-self: flex-start;
    width: min(100%, 28rem);
    gap: var(--size-4-2);
}

.journalyst-card-calendar-label {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 1.25rem;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
}

.journalyst-card-calendar-blank,
.journalyst-card-calendar-day {
    aspect-ratio: 1;
    min-width: 0;
    min-height: 0;
    border-radius: 2px;
}

.journalyst-card-calendar-blank {
    visibility: hidden;
}

.journalyst-card-calendar-day {
    display: flex;
    align-items: center;
    justify-content: center;
    height: auto;
    padding: 0;
    appearance: none;
    border: var(--border-width) solid var(--background-modifier-border);
    background: var(--background-primary);
    box-shadow: none;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: 1;
    cursor: pointer;
}

.journalyst-card-calendar-day.is-complete {
    border-color: var(--interactive-accent);
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.journalyst-card-calendar-day.is-draft {
    border: var(--border-width) solid var(--text-warning);
    background: var(--journalyst-base-recessed);
    color: var(--text-warning);
}

.journalyst-card-calendar-day.is-due-today {
    border: var(--border-width) dashed var(--text-warning);
    background: transparent;
    color: var(--text-warning);
}

.journalyst-card-calendar-day.is-unfinished-today {
    border: var(--border-width) solid var(--text-warning);
    background: var(--background-modifier-hover);
    color: var(--text-warning);
}

.journalyst-card-calendar-day.is-missing-expected {
    border: var(--border-width) dashed var(--text-error);
    background: transparent;
    color: var(--text-muted);
}

.journalyst-card-calendar-day.is-skipped {
    border-color: var(--background-modifier-border);
    background: transparent;
    color: var(--text-faint);
}

.journalyst-card-calendar-day.is-future {
    border-color: var(--journalyst-base-recessed);
    background: transparent;
    color: var(--text-faint);
}

.journalyst-card-calendar-day:hover {
    border-color: var(--interactive-accent);
    box-shadow: none;
}

.journalyst-card-calendar-day:not(.is-complete):hover,
.journalyst-card-calendar-day:not(.is-complete):focus-visible {
    color: var(--text-normal);
}

.journalyst-card-calendar-day:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}
</style>
