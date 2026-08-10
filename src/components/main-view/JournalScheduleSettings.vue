<script setup lang="ts">
import { computed } from 'vue';
import moment from 'moment';
import {
    getCadenceLabel,
    type JournalCadenceConfig,
    type JournalCadenceType,
    type JournalSchedulePause,
} from '../../../cadence';
import type { JournalAutosaveFeedback, JournalSettingsViewModel } from '../../../journalSettings';
import AlertCard from '../AlertCard.vue';
import ObsidianIcon from '../ObsidianIcon.vue';
import JournalAutosaveStatus from './JournalAutosaveStatus.vue';

const props = defineProps<{
    model: JournalSettingsViewModel;
    pauses: JournalSchedulePause[];
    autosave: JournalAutosaveFeedback;
    invalid: boolean;
}>();

const cadence = defineModel<JournalCadenceConfig>('cadence', { required: true });

const emit = defineEmits<{
    commit: [];
    retry: [];
    undo: [];
    editPause: [pause: JournalSchedulePause | null];
    removePause: [pause: JournalSchedulePause];
}>();

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const todayDate = computed(() => moment().format('YYYY-MM-DD'));

const changeLog = computed(() => props.model.cadenceHistory.map((revision, index, revisions) => {
    const previous = revisions[index - 1] ?? null;
    const next = revisions[index + 1] ?? null;
    return {
        effectiveFrom: revision.effectiveFrom,
        previousLabel: previous ? getCadenceLabel(previous.cadence) : null,
        cadenceLabel: getCadenceLabel(revision.cadence),
        endDate: next
            ? moment(next.effectiveFrom, 'YYYY-MM-DD', true).subtract(1, 'day').format('YYYY-MM-DD')
            : null,
        isCurrent: index === revisions.length - 1,
        isCreated: index === 0,
    };
}).reverse());

const sortedPauses = computed(() => {
    const today = todayDate.value;
    const getRank = (pause: JournalSchedulePause) => {
        if (pause.startDate <= today && pause.endDate >= today) return 0;
        if (pause.startDate > today) return 1;
        return 2;
    };

    return [...props.pauses].sort((left, right) => {
        const rankDifference = getRank(left) - getRank(right);
        if (rankDifference !== 0) return rankDifference;
        if (getRank(left) === 2) return right.startDate.localeCompare(left.startDate);
        return left.startDate.localeCompare(right.startDate);
    });
});

function setCadenceType(type: JournalCadenceType) {
    if (type === 'weekly-days') {
        cadence.value = { type, weekdays: cadence.value.weekdays ?? [1] };
    } else if (type === 'interval') {
        cadence.value = {
            type,
            intervalDays: cadence.value.intervalDays ?? 3,
            startDate: cadence.value.startDate ?? todayDate.value,
        };
    } else {
        cadence.value = { type };
    }
    emit('commit');
}

function toggleWeekday(day: number) {
    const weekdays = new Set(cadence.value.weekdays ?? []);
    if (weekdays.has(day)) weekdays.delete(day);
    else weekdays.add(day);
    cadence.value = { type: 'weekly-days', weekdays: [...weekdays].sort((left, right) => left - right) };
    emit('commit');
}

function setIntervalDays(event: Event) {
    cadence.value = {
        ...cadence.value,
        intervalDays: Number.parseInt((event.target as HTMLInputElement).value, 10) || 1,
    };
}

function setIntervalStart(event: Event) {
    cadence.value = { ...cadence.value, startDate: (event.target as HTMLInputElement).value };
}

function getPauseStatus(pause: JournalSchedulePause) {
    if (pause.startDate <= todayDate.value && pause.endDate >= todayDate.value) return 'Active';
    if (pause.startDate > todayDate.value) return 'Upcoming';
    return 'Past';
}

function getPauseDateLabel(pause: JournalSchedulePause) {
    const start = moment(pause.startDate, 'YYYY-MM-DD', true).format('MMM D, YYYY');
    if (pause.startDate === pause.endDate) return start;
    return `${start} to ${moment(pause.endDate, 'YYYY-MM-DD', true).format('MMM D, YYYY')}`;
}
</script>

<template>
    <div class="journalyst-schedule-settings">
        <section class="journalyst-schedule-block">
            <header class="journalyst-settings-block-header">
                <span class="journalyst-settings-block-title">
                    <ObsidianIcon name="circle-dot" />
                    <span>Current rule</span>
                </span>
                <span class="journalyst-current-rule-badge">{{ getCadenceLabel(cadence) }}</span>
            </header>

            <div class="journalyst-schedule-setting-row">
                <div>
                    <h3>Cadence</h3>
                    <p>How often an entry is expected in this journal.</p>
                </div>
                <select :value="cadence.type" aria-label="Cadence" @change="setCadenceType(($event.target as HTMLSelectElement).value as JournalCadenceType)">
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekly-days">Specific weekdays</option>
                    <option value="interval">Custom interval</option>
                    <option value="adhoc">Ad hoc</option>
                </select>
            </div>

            <div v-if="cadence.type === 'weekly-days'" class="journalyst-schedule-setting-row is-weekdays">
                <div>
                    <h3>Expected weekdays</h3>
                    <p>Choose each day this journal should receive an entry.</p>
                </div>
                <div>
                    <div class="journalyst-weekday-buttons">
                        <button
                            v-for="(label, day) in weekdayLabels"
                            :key="day"
                            type="button"
                            :class="{ 'is-selected': cadence.weekdays?.includes(day) }"
                            :aria-pressed="cadence.weekdays?.includes(day)"
                            @click="toggleWeekday(day)"
                        >{{ label }}</button>
                    </div>
                    <p v-if="invalid" class="journalyst-field-error">Choose at least one weekday.</p>
                </div>
            </div>

            <template v-if="cadence.type === 'interval'">
                <div class="journalyst-schedule-setting-row">
                    <div>
                        <h3>Interval</h3>
                        <p>Set the number of days between expected entries.</p>
                    </div>
                    <div class="journalyst-input-suffix">
                        <input
                            type="number"
                            min="1"
                            :value="cadence.intervalDays"
                            aria-label="Interval days"
                            @input="setIntervalDays"
                            @change="emit('commit')"
                            @blur="emit('commit')"
                        >
                        <span>days</span>
                    </div>
                </div>
                <div class="journalyst-schedule-setting-row">
                    <div>
                        <h3>Anchor date</h3>
                        <p>The date used to calculate the repeating interval.</p>
                    </div>
                    <input
                        type="date"
                        :value="cadence.startDate"
                        aria-label="Interval anchor date"
                        @input="setIntervalStart"
                        @change="emit('commit')"
                        @blur="emit('commit')"
                    >
                </div>
            </template>

            <JournalAutosaveStatus :feedback="autosave" @retry="emit('retry')" @undo="emit('undo')" />
        </section>

        <section class="journalyst-schedule-block">
            <header class="journalyst-settings-block-header">
                <span class="journalyst-settings-block-title">
                    <ObsidianIcon name="history" />
                    <span>Schedule change log</span>
                </span>
                <span>{{ model.cadenceHistory.length }} {{ model.cadenceHistory.length === 1 ? 'revision' : 'revisions' }}</span>
            </header>

            <AlertCard
                class="journalyst-schedule-guidance"
                tone="accent"
                density="compact"
                icon="info"
                title="Dates keep their original schedule"
                description="Each day uses the rule active on that date, so a cadence change never creates backdated misses."
            />

            <ol class="journalyst-schedule-history">
                <li v-for="revision in changeLog" :key="revision.effectiveFrom" :class="{ 'is-current': revision.isCurrent }">
                    <span class="journalyst-schedule-history-dot" aria-hidden="true" />
                    <div class="journalyst-schedule-history-copy">
                        <div class="journalyst-schedule-history-rule">
                            <template v-if="revision.previousLabel">
                                <span>{{ revision.previousLabel }}</span>
                                <ObsidianIcon name="arrow-right" />
                            </template>
                            <strong>{{ revision.cadenceLabel }}</strong>
                            <span v-if="revision.isCurrent" class="journalyst-schedule-history-badge is-current">In effect</span>
                            <span v-if="revision.isCreated" class="journalyst-schedule-history-badge">Created</span>
                        </div>
                        <span class="journalyst-schedule-history-range">
                            {{ moment(revision.effectiveFrom, 'YYYY-MM-DD', true).format('MMM D, YYYY') }}
                            to
                            {{ revision.endDate ? moment(revision.endDate, 'YYYY-MM-DD', true).format('MMM D, YYYY') : 'now' }}
                        </span>
                    </div>
                </li>
            </ol>
        </section>

        <section class="journalyst-schedule-block">
            <header class="journalyst-settings-block-header">
                <span class="journalyst-settings-block-title">
                    <ObsidianIcon name="archive" />
                    <span>Pauses and exceptions</span>
                </span>
                <button type="button" class="journalyst-section-text-action" @click="$emit('editPause', null)">
                    <ObsidianIcon name="plus" />
                    <span>Add pause</span>
                </button>
            </header>

            <div v-if="sortedPauses.length === 0" class="journalyst-schedule-empty-state">
                No pauses or exceptions have been added.
            </div>
            <ul v-else class="journalyst-schedule-pauses">
                <li v-for="pause in sortedPauses" :key="pause.id">
                    <ObsidianIcon name="clock-3" />
                    <div class="journalyst-schedule-pause-copy">
                        <strong>{{ pause.name }}</strong>
                        <span>{{ getPauseDateLabel(pause) }}</span>
                    </div>
                    <span class="journalyst-schedule-pause-status" :class="`is-${getPauseStatus(pause).toLowerCase()}`">
                        {{ getPauseStatus(pause) }}
                    </span>
                    <button type="button" class="clickable-icon" :aria-label="`Edit ${pause.name}`" title="Edit pause" @click="$emit('editPause', pause)">
                        <ObsidianIcon name="pencil" />
                    </button>
                    <button type="button" class="clickable-icon" :aria-label="`Remove ${pause.name}`" title="Remove pause" @click="$emit('removePause', pause)">
                        <ObsidianIcon name="x" />
                    </button>
                </li>
            </ul>
        </section>
    </div>
</template>

<style scoped>
.journalyst-schedule-settings,
.journalyst-schedule-block {
    display: flex;
    min-width: 0;
    flex-direction: column;
}

.journalyst-schedule-settings {
    gap: var(--size-4-6);
    container-type: inline-size;
}

.journalyst-settings-block-header {
    display: flex;
    min-height: var(--input-height);
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-3);
    padding-bottom: var(--size-4-2);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
}

.journalyst-settings-block-title,
.journalyst-section-text-action,
.journalyst-schedule-history-rule {
    display: inline-flex;
    align-items: center;
}

.journalyst-settings-block-title {
    gap: var(--size-4-2);
    text-transform: uppercase;
}

.journalyst-current-rule-badge,
.journalyst-schedule-history-badge,
.journalyst-schedule-pause-status {
    padding: var(--size-2-1) var(--size-4-2);
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    font-size: var(--font-ui-smaller);
}

.journalyst-current-rule-badge {
    color: var(--text-accent);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
}

.journalyst-schedule-setting-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(12rem, 20rem);
    align-items: center;
    gap: var(--size-4-5);
    padding: var(--size-4-4) var(--size-4-1);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-schedule-setting-row h3,
.journalyst-schedule-setting-row p {
    margin: 0;
}

.journalyst-schedule-setting-row h3 {
    font-size: var(--font-ui-medium);
}

.journalyst-schedule-setting-row p,
.journalyst-schedule-history-range,
.journalyst-schedule-pause-copy span,
.journalyst-schedule-empty-state {
    color: var(--text-muted);
}

.journalyst-schedule-setting-row p {
    margin-top: var(--size-4-1);
}

.journalyst-schedule-setting-row select,
.journalyst-schedule-setting-row > input,
.journalyst-schedule-setting-row > .journalyst-input-suffix {
    width: 100%;
}

.journalyst-weekday-buttons {
    display: grid;
    grid-template-columns: repeat(7, minmax(2.25rem, 1fr));
    gap: var(--size-4-1);
}

.journalyst-weekday-buttons button {
    min-width: 0;
    padding-inline: var(--size-4-1);
}

.journalyst-weekday-buttons button.is-selected {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.journalyst-input-suffix {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
}

.journalyst-input-suffix input {
    width: 7rem;
}

.journalyst-field-error {
    color: var(--text-error);
}

.journalyst-schedule-guidance {
    margin-top: var(--size-4-3);
}

.journalyst-schedule-history,
.journalyst-schedule-pauses {
    margin: 0;
    padding: var(--size-4-3) 0 0;
    list-style: none;
}

.journalyst-schedule-history li {
    position: relative;
    padding: var(--size-4-2) 0 var(--size-4-3) var(--size-4-5);
}

.journalyst-schedule-history li:not(:last-child)::before {
    position: absolute;
    top: 1.15rem;
    bottom: -0.6rem;
    left: 0.32rem;
    width: var(--border-width);
    background: var(--background-modifier-border);
    content: '';
}

.journalyst-schedule-history-dot {
    position: absolute;
    top: 0.95rem;
    left: 0;
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
    background: var(--background-modifier-border);
}

.journalyst-schedule-history li.is-current .journalyst-schedule-history-dot {
    background: var(--interactive-accent);
}

.journalyst-schedule-history-copy {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--size-4-4);
}

.journalyst-schedule-history-rule {
    min-width: 0;
    gap: var(--size-4-2);
    flex-wrap: wrap;
}

.journalyst-schedule-history-rule > span:first-child {
    color: var(--text-muted);
    text-decoration: line-through;
}

.journalyst-schedule-history-badge.is-current,
.journalyst-schedule-pause-status.is-active {
    color: var(--text-success);
}

.journalyst-section-text-action {
    width: auto;
    gap: var(--size-4-1);
    padding: var(--size-4-1) var(--size-4-2);
    border: 0;
    box-shadow: none;
    background: transparent;
    color: var(--text-muted);
}

.journalyst-section-text-action:hover {
    background: transparent;
    color: var(--text-accent);
}

.journalyst-schedule-pauses li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto auto;
    align-items: center;
    gap: var(--size-4-3);
    padding: var(--size-4-3) var(--size-4-1);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-schedule-pause-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-4-1);
}

.journalyst-schedule-pause-copy strong,
.journalyst-schedule-pause-copy span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.journalyst-schedule-pause-status.is-upcoming {
    color: var(--text-accent);
}

.journalyst-schedule-pause-status.is-past {
    color: var(--text-muted);
}

.journalyst-schedule-empty-state {
    padding: var(--size-4-4) var(--size-4-1);
}

button:focus-visible,
select:focus-visible,
input:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@media (max-width: 760px) {
    .journalyst-schedule-setting-row {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--size-4-3);
    }

}

@media (max-width: 520px) {
    .journalyst-weekday-buttons {
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .journalyst-schedule-history-copy,
    .journalyst-settings-block-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .journalyst-schedule-pauses li {
        grid-template-columns: auto minmax(0, 1fr) auto auto;
    }

    .journalyst-schedule-pause-status {
        display: none;
    }
}
</style>
