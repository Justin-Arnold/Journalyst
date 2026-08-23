<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { SynthesisHistoryItem } from '../../../review/types';
import ObsidianIcon from '../ObsidianIcon.vue';
import WorkspaceSection from './WorkspaceSection.vue';

const props = defineProps<{
    items: SynthesisHistoryItem[];
}>();

const emit = defineEmits<{
    openNote: [filePath: string];
}>();

const showAll = ref(false);
const visibleItems = computed(() => showAll.value ? props.items : props.items.slice(0, 10));

watch(() => props.items, () => {
    showAll.value = false;
});
</script>

<template>
    <WorkspaceSection title="Past syntheses" description="Reflection notes already created for earlier periods in this journal.">
        <div v-if="items.length" class="journalyst-synthesis-history-list">
            <button
                v-for="item in visibleItems"
                :key="item.filePath"
                type="button"
                class="journalyst-synthesis-history-row"
                :aria-label="`Open ${item.title}`"
                @click="emit('openNote', item.filePath)"
            >
                <span class="journalyst-synthesis-history-icon" aria-hidden="true">
                    <ObsidianIcon name="file-pen-line" />
                </span>
                <span class="journalyst-synthesis-history-identity">
                    <strong>{{ item.title }}</strong>
                    <small :title="item.pathLabel">{{ item.pathLabel }}</small>
                </span>
                <span class="journalyst-synthesis-history-count">
                    {{ item.completedEntryCount }} {{ item.completedEntryCount === 1 ? 'entry' : 'entries' }}
                </span>
                <span class="journalyst-synthesis-history-created">Created {{ item.createdDateLabel }}</span>
                <ObsidianIcon name="external-link" />
            </button>
        </div>

        <div v-else class="journalyst-synthesis-history-empty">
            <ObsidianIcon name="archive" />
            <span>Earlier synthesis notes will appear here after you create them.</span>
        </div>

        <button
            v-if="items.length > 10"
            type="button"
            class="journalyst-synthesis-history-toggle"
            @click="showAll = !showAll"
        >
            <ObsidianIcon :name="showAll ? 'chevron-up' : 'chevron-down'" />
            {{ showAll ? 'Show less' : `Show all ${items.length}` }}
        </button>
    </WorkspaceSection>
</template>

<style scoped>
.journalyst-synthesis-history-list {
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-synthesis-history-row {
    display: grid;
    width: 100%;
    height: auto;
    grid-template-columns: auto minmax(0, 1fr) auto auto auto;
    align-items: center;
    gap: var(--size-4-3);
    padding: var(--size-4-3) var(--size-4-4);
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
    text-align: left;
}

.journalyst-synthesis-history-row + .journalyst-synthesis-history-row {
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-synthesis-history-row:hover {
    background: var(--background-modifier-hover);
}

.journalyst-synthesis-history-row:focus-visible,
.journalyst-synthesis-history-toggle:focus-visible {
    position: relative;
    z-index: 1;
    outline: 2px solid var(--interactive-accent);
    outline-offset: -2px;
}

.journalyst-synthesis-history-icon {
    display: inline-flex;
    width: 2rem;
    height: 2rem;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-accent);
}

.journalyst-synthesis-history-identity {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-4-1);
}

.journalyst-synthesis-history-identity strong,
.journalyst-synthesis-history-identity small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-synthesis-history-identity strong {
    color: var(--text-normal);
    font-size: var(--font-ui-small);
}

.journalyst-synthesis-history-identity small,
.journalyst-synthesis-history-created,
.journalyst-synthesis-history-count {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
}

.journalyst-synthesis-history-count {
    padding: var(--size-4-1) var(--size-4-2);
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    white-space: nowrap;
}

.journalyst-synthesis-history-created {
    white-space: nowrap;
}

.journalyst-synthesis-history-empty {
    display: flex;
    align-items: center;
    gap: var(--size-4-3);
    padding: var(--size-4-5);
    border: var(--border-width) dashed var(--background-modifier-border);
    border-radius: var(--radius-s);
    color: var(--text-faint);
}

.journalyst-synthesis-history-toggle {
    display: inline-flex;
    width: auto;
    align-items: center;
    gap: var(--size-4-2);
    margin-top: var(--size-4-3);
    border: 0;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
}

.journalyst-synthesis-history-toggle:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

@container (max-width: 48rem) {
    .journalyst-synthesis-history-row {
        grid-template-columns: auto minmax(0, 1fr) auto;
    }

    .journalyst-synthesis-history-count,
    .journalyst-synthesis-history-created {
        grid-column: 2;
    }

    .journalyst-synthesis-history-created {
        display: none;
    }
}
</style>
