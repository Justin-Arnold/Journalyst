<script setup lang="ts">
import type { SynthesisNotePreview } from '../../../review/types';
import ObsidianIcon from '../ObsidianIcon.vue';

defineProps<{
    journalPath: string;
    preview: SynthesisNotePreview;
    focused: boolean;
}>();

const emit = defineEmits<{
    openNote: [filePath: string];
    createNote: [];
    previewNote: [];
}>();
</script>

<template>
    <article
        class="journalyst-synthesis-period-card"
        :class="{ 'is-attention-target': focused }"
        :data-synthesis-period="preview.periodType"
        tabindex="-1"
    >
        <div class="journalyst-synthesis-period-marker" aria-hidden="true">
            <span>{{ preview.markerLabel }}</span>
            <strong>{{ preview.markerValue }}</strong>
            <small>{{ preview.dateRangeLabel }}</small>
        </div>

        <div class="journalyst-synthesis-period-content">
            <header>
                <div>
                    <h2>{{ preview.title }}</h2>
                    <p>{{ preview.summaryText }}</p>
                </div>
                <span
                    class="journalyst-synthesis-period-status"
                    :class="{
                        'is-ready': !preview.existingFilePath && !preview.isFuturePeriod,
                        'is-existing': !!preview.existingFilePath,
                    }"
                >
                    {{ preview.existingFilePath ? 'Saved' : preview.isFuturePeriod ? 'Not started' : 'Ready' }}
                </span>
            </header>

            <div class="journalyst-synthesis-period-meta">
                <span>
                    <ObsidianIcon name="files" />
                    {{ preview.sourceEntries.length }} included
                </span>
                <span>
                    <ObsidianIcon name="message-square-text" />
                    {{ preview.reflectionPrompts.length }} prompts
                </span>
                <span>
                    <ObsidianIcon name="circle-dashed" />
                    {{ preview.unfinishedEntryCount }} unfinished
                </span>
                <span
                    class="journalyst-synthesis-period-path"
                    :title="preview.existingFilePath ?? `${journalPath}/${preview.fileName}`"
                >
                    {{ preview.existingFilePath ?? `${journalPath}/${preview.fileName}` }}
                </span>
            </div>

            <p v-if="preview.patterns[1]" class="journalyst-synthesis-period-pattern">
                <ObsidianIcon name="sparkles" />
                <span>{{ preview.patterns[1] }}</span>
            </p>

            <div class="journalyst-synthesis-prompt-preview" aria-label="Reflection prompt preview">
                <p v-for="prompt in preview.reflectionPrompts.slice(0, 2)" :key="prompt">{{ prompt }}</p>
                <span v-if="preview.reflectionPrompts.length > 2">
                    +{{ preview.reflectionPrompts.length - 2 }} more
                </span>
            </div>

            <footer>
                <div class="journalyst-synthesis-period-actions">
                    <button
                        v-if="preview.existingFilePath"
                        type="button"
                        class="mod-cta"
                        @click="emit('openNote', preview.existingFilePath)"
                    >
                        <ObsidianIcon name="external-link" />
                        Open synthesis
                    </button>
                    <button v-else type="button" class="mod-cta" @click="emit('createNote')">
                        <ObsidianIcon name="file-pen-line" />
                        Create synthesis
                    </button>
                    <button type="button" class="journalyst-synthesis-preview-action" @click="emit('previewNote')">
                        <ObsidianIcon name="eye" />
                        Preview content
                    </button>
                </div>

                <span class="journalyst-synthesis-period-state">
                    <ObsidianIcon :name="preview.existingFilePath ? 'circle-check' : 'clock-3'" />
                    {{ preview.existingFilePath ? 'Note exists' : 'Not yet created' }}
                </span>
            </footer>
        </div>
    </article>
</template>

<style scoped>
.journalyst-synthesis-period-card {
    display: grid;
    grid-template-columns: 7.5rem minmax(0, 1fr);
    min-width: 0;
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-synthesis-period-card.is-attention-target,
.journalyst-synthesis-period-card:focus {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

.journalyst-synthesis-period-marker {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-4-2);
    padding: var(--size-4-5);
    border-right: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-synthesis-period-marker span {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    text-transform: uppercase;
}

.journalyst-synthesis-period-marker strong {
    color: var(--text-accent);
    font-size: 2rem;
    font-weight: 500;
    line-height: 1;
    overflow-wrap: anywhere;
}

.journalyst-synthesis-period-marker small {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    line-height: 1.4;
}

.journalyst-synthesis-period-content {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-4-4);
    padding: var(--size-4-5);
}

.journalyst-synthesis-period-content > header,
.journalyst-synthesis-period-content > footer,
.journalyst-synthesis-period-actions,
.journalyst-synthesis-period-meta,
.journalyst-synthesis-period-meta span,
.journalyst-synthesis-period-state {
    display: flex;
    align-items: center;
}

.journalyst-synthesis-period-content > header,
.journalyst-synthesis-period-content > footer {
    min-width: 0;
    justify-content: space-between;
    gap: var(--size-4-4);
}

.journalyst-synthesis-period-content > header {
    align-items: flex-start;
}

.journalyst-synthesis-period-content h2,
.journalyst-synthesis-period-content header p,
.journalyst-synthesis-period-pattern,
.journalyst-synthesis-prompt-preview p {
    margin: 0;
}

.journalyst-synthesis-period-pattern {
    display: flex;
    align-items: flex-start;
    gap: var(--size-4-2);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    line-height: 1.4;
}

.journalyst-synthesis-period-pattern :deep(.svg-icon) {
    flex: 0 0 auto;
    color: var(--text-accent);
}

.journalyst-synthesis-period-content h2 {
    color: var(--text-normal);
    font-size: var(--font-ui-large);
    overflow-wrap: anywhere;
}

.journalyst-synthesis-period-content header p {
    margin-top: var(--size-4-1);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    line-height: 1.45;
}

.journalyst-synthesis-period-status {
    flex: 0 0 auto;
    padding: var(--size-4-1) var(--size-4-2);
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
}

.journalyst-synthesis-period-status.is-ready {
    color: var(--text-accent);
}

.journalyst-synthesis-period-status.is-existing {
    color: var(--text-success);
}

.journalyst-synthesis-period-meta {
    min-width: 0;
    flex-wrap: wrap;
    gap: var(--size-4-3);
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
}

.journalyst-synthesis-period-meta span {
    min-width: 0;
    gap: var(--size-4-1);
}

.journalyst-synthesis-period-path {
    flex: 1 1 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-synthesis-prompt-preview {
    display: grid;
    gap: var(--size-4-2);
    padding-left: var(--size-4-4);
    border-left: 2px solid var(--background-modifier-border);
}

.journalyst-synthesis-prompt-preview p {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    font-style: italic;
    line-height: 1.4;
}

.journalyst-synthesis-prompt-preview > span {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
}

.journalyst-synthesis-period-content > footer {
    margin-top: auto;
}

.journalyst-synthesis-period-actions {
    flex-wrap: wrap;
    gap: var(--size-4-2);
}

.journalyst-synthesis-period-actions button,
.journalyst-synthesis-preview-action,
.journalyst-synthesis-period-state {
    gap: var(--size-4-2);
}

.journalyst-synthesis-preview-action {
    display: inline-flex;
    width: auto;
    align-items: center;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
}

.journalyst-synthesis-preview-action:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

.journalyst-synthesis-period-actions button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

.journalyst-synthesis-period-state {
    flex: 0 0 auto;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
}

@container (max-width: 42rem) {
    .journalyst-synthesis-period-card {
        grid-template-columns: 1fr;
    }

    .journalyst-synthesis-period-marker {
        display: grid;
        grid-template-columns: auto auto minmax(0, 1fr);
        align-items: baseline;
        padding: var(--size-4-3) var(--size-4-4);
        border-right: 0;
        border-bottom: var(--border-width) solid var(--background-modifier-border);
    }

    .journalyst-synthesis-period-marker strong {
        font-size: var(--font-ui-large);
    }

    .journalyst-synthesis-period-marker small {
        text-align: right;
    }
}

@container (max-width: 30rem) {
    .journalyst-synthesis-period-content > header,
    .journalyst-synthesis-period-content > footer {
        align-items: flex-start;
        flex-direction: column;
    }

    .journalyst-synthesis-period-state {
        align-self: flex-start;
    }
}
</style>
