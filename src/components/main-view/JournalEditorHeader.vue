<script setup lang="ts">
import { getCadenceLabel } from '../../../cadence';
import type {
    JournalSettingsSection,
    JournalSettingsViewModel,
} from '../../../journalSettings';
import ObsidianIcon from '../ObsidianIcon.vue';

defineProps<{
    model: JournalSettingsViewModel;
    sections: Array<{ id: JournalSettingsSection; label: string; icon: string }>;
    activeSection: JournalSettingsSection;
    renameOpen: boolean;
    busy: boolean;
}>();

const renameDraft = defineModel<string>('renameDraft', { required: true });

defineEmits<{
    edit: [];
    cancelRename: [];
    rename: [];
    selectSection: [section: JournalSettingsSection];
}>();

function getEntryCountLabel(entryCount: number) {
    return `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`;
}
</script>

<template>
    <header class="journalyst-journal-editor-header">
        <div class="journalyst-journal-identity-row">
            <div class="journalyst-journal-identity">
                <span class="journalyst-journal-identity-icon" aria-hidden="true">
                    <ObsidianIcon name="notebook-pen" />
                </span>
                <div class="journalyst-journal-identity-copy">
                    <h2 :title="model.journalName">{{ model.journalName }}</h2>
                    <p class="journalyst-journal-identity-meta">
                        <span class="journalyst-journal-path" :title="model.journalPath">{{ model.journalPath }}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span>{{ getEntryCountLabel(model.entryCount) }}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span>{{ getCadenceLabel(model.cadence) }}</span>
                    </p>
                </div>
            </div>

            <button
                type="button"
                class="journalyst-journal-edit-button"
                aria-controls="journalyst-journal-rename"
                :aria-expanded="renameOpen"
                @click="$emit('edit')"
            >
                <ObsidianIcon name="pencil" />
                <span>Edit</span>
            </button>
        </div>

        <form
            v-if="renameOpen"
            id="journalyst-journal-rename"
            class="journalyst-journal-rename"
            @submit.prevent="$emit('rename')"
        >
            <input v-model="renameDraft" aria-label="Journal name" autocomplete="off">
            <button type="submit" class="mod-cta" :disabled="busy || !renameDraft.trim()">Rename</button>
            <button type="button" @click="$emit('cancelRename')">Cancel</button>
        </form>

        <div class="journalyst-journal-section-tabs" role="tablist" aria-label="Journal settings sections">
            <button
                v-for="item in sections"
                :id="`journalyst-journal-section-tab-${item.id}`"
                :key="item.id"
                type="button"
                role="tab"
                :aria-selected="activeSection === item.id"
                :class="{ 'is-active': activeSection === item.id }"
                @click="$emit('selectSection', item.id)"
            >
                <ObsidianIcon :name="item.icon" />
                <span>{{ item.label }}</span>
            </button>
        </div>
    </header>
</template>

<style scoped>
.journalyst-journal-editor-header {
    min-width: 0;
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-journal-identity-row,
.journalyst-journal-identity {
    display: flex;
    align-items: center;
}

.journalyst-journal-identity-row {
    justify-content: space-between;
    gap: var(--size-4-4);
    padding-bottom: var(--size-4-3);
}

.journalyst-journal-identity {
    min-width: 0;
    gap: var(--size-4-3);
}

.journalyst-journal-identity-icon {
    display: inline-flex;
    width: 2.75rem;
    height: 2.75rem;
    flex: 0 0 2.75rem;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-accent);
}

.journalyst-journal-identity-copy {
    min-width: 0;
}

.journalyst-journal-identity-copy h2 {
    margin: 0;
    overflow: hidden;
    color: var(--text-normal);
    font-size: var(--h2-size);
    font-weight: var(--h2-weight);
    white-space: nowrap;
    text-overflow: ellipsis;
}

.journalyst-journal-identity-meta {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 var(--size-4-2);
    margin: var(--size-4-1) 0 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
}

.journalyst-journal-path {
    max-width: min(100%, 28rem);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.journalyst-journal-edit-button {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--size-4-2);
    min-height: var(--input-height);
    padding: var(--size-4-2) var(--size-4-3);
    border: var(--border-width) solid var(--background-modifier-border);
    box-shadow: var(--input-shadow);
    background: var(--interactive-normal);
    color: var(--text-normal);
}

.journalyst-journal-edit-button:hover {
    background: var(--interactive-hover);
}

.journalyst-journal-rename {
    display: flex;
    gap: var(--size-4-2);
    margin-bottom: var(--size-4-3);
    flex-wrap: wrap;
}

.journalyst-journal-rename input {
    flex: 1 1 14rem;
}

.journalyst-journal-section-tabs {
    display: flex;
    gap: var(--size-4-4);
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: thin;
}

.journalyst-journal-section-tabs button {
    position: relative;
    display: inline-flex;
    width: auto;
    min-height: var(--input-height);
    flex: 0 0 auto;
    align-items: center;
    gap: var(--size-4-2);
    padding: var(--size-4-3) var(--size-4-1);
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
    color: var(--text-muted);
    white-space: nowrap;
}

.journalyst-journal-section-tabs button:hover,
.journalyst-journal-section-tabs button.is-active {
    background: transparent;
    color: var(--text-accent);
}

.journalyst-journal-section-tabs button.is-active::after {
    position: absolute;
    right: 0;
    bottom: -1px;
    left: 0;
    height: 2px;
    background: var(--interactive-accent);
    content: '';
}

.journalyst-journal-edit-button:focus-visible,
.journalyst-journal-section-tabs button:focus-visible,
.journalyst-journal-rename button:focus-visible,
.journalyst-journal-rename input:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@media (max-width: 520px) {
    .journalyst-journal-identity-row {
        align-items: flex-start;
    }

    .journalyst-journal-identity-icon {
        width: 2.25rem;
        height: 2.25rem;
        flex-basis: 2.25rem;
    }

    .journalyst-journal-identity-copy h2 {
        font-size: var(--font-ui-large);
    }

    .journalyst-journal-section-tabs {
        gap: var(--size-4-3);
    }
}
</style>
