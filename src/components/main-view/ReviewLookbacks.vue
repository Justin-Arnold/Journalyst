<script setup lang="ts">
import { computed } from 'vue';
import moment from 'moment';
import type {
    LookbackResult,
    ReviewLookbackPreview,
} from '../../../review/types';
import ObsidianIcon from '../ObsidianIcon.vue';
import WorkspaceSection from './WorkspaceSection.vue';

const props = defineProps<{
    lookbacks: LookbackResult[];
    previews: ReviewLookbackPreview[];
    loading: boolean;
}>();

const emit = defineEmits<{
    openNote: [filePath: string];
}>();

const previewByDate = computed(() => new Map(
    props.previews.map(preview => [preview.targetDate, preview]),
));

function getPreview(lookback: LookbackResult) {
    return previewByDate.value.get(lookback.targetDate);
}

function getTitle(lookback: LookbackResult) {
    return getPreview(lookback)?.title
        ?? moment(lookback.targetDate, 'YYYY-MM-DD', true).format('MMMM D, YYYY');
}

function getExcerpt(lookback: LookbackResult) {
    if (!lookback.entry) return 'Nothing written on this date.';
    if (props.loading && !getPreview(lookback)) return 'Loading preview...';
    return getPreview(lookback)?.excerpt ?? 'No written content yet.';
}
</script>

<template>
    <WorkspaceSection title="Lookbacks" description="Revisit what you wrote at the same point in earlier windows.">
        <div class="journalyst-review-lookback-grid">
            <article
                v-for="lookback in lookbacks"
                :key="lookback.targetDate"
                class="journalyst-review-lookback-card"
                :class="{ 'is-empty': !lookback.entry }"
            >
                <div class="journalyst-review-lookback-heading">
                    <span>
                        {{ lookback.label }} · {{ moment(lookback.targetDate).format('YYYY-MM-DD') }}
                    </span>
                    <span
                        v-if="lookback.entry && !lookback.entry.isComplete"
                        class="journalyst-review-lookback-status"
                    >
                        Unfinished
                    </span>
                </div>
                <h3>{{ getTitle(lookback) }}</h3>
                <p :class="{ 'is-empty': !lookback.entry }">
                    {{ getExcerpt(lookback) }}
                </p>
                <button
                    v-if="lookback.entry"
                    type="button"
                    @click="emit('openNote', lookback.entry.filePath)"
                >
                    <ObsidianIcon name="external-link" />
                    Open
                </button>
            </article>
        </div>
    </WorkspaceSection>
</template>

<style scoped>
.journalyst-review-lookback-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--size-4-3);
}

.journalyst-review-lookback-card {
    display: flex;
    min-width: 0;
    min-height: 13rem;
    flex-direction: column;
    gap: var(--size-4-3);
    padding: var(--size-4-4);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-review-lookback-card.is-empty {
    border-style: dashed;
    background: transparent;
}

.journalyst-review-lookback-heading {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-2);
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    text-transform: uppercase;
}

.journalyst-review-lookback-heading > span:first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-review-lookback-status {
    flex: 0 0 auto;
    color: var(--text-warning);
    text-transform: none;
}

.journalyst-review-lookback-card h3 {
    margin: 0;
    color: var(--text-normal);
    font-size: var(--font-ui-medium);
    line-height: 1.25;
    overflow-wrap: anywhere;
}

.journalyst-review-lookback-card p {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    line-height: 1.45;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
}

.journalyst-review-lookback-card p.is-empty {
    color: var(--text-faint);
    font-style: italic;
}

.journalyst-review-lookback-card button {
    display: inline-flex;
    width: auto;
    align-items: center;
    align-self: flex-start;
    gap: var(--size-4-2);
    margin-top: auto;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
}

.journalyst-review-lookback-card button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

.journalyst-review-lookback-card button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@container (max-width: 62rem) {
    .journalyst-review-lookback-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@container (max-width: 35rem) {
    .journalyst-review-lookback-grid {
        grid-template-columns: 1fr;
    }

    .journalyst-review-lookback-card {
        min-height: 10rem;
    }
}
</style>
