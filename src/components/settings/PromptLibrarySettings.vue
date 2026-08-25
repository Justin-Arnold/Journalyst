<script setup lang="ts">
import { computed } from 'vue';
import AlertCard from '../AlertCard.vue';
import ObsidianIcon from '../ObsidianIcon.vue';
import ObsidianButton from './ObsidianButton.vue';
import SettingsGroup from './SettingsGroup.vue';
import type {
    JournalystSettingsActions,
    PromptLibraryListItem,
    PromptSettingsModel,
} from './types';
import { useSettingsAction } from './useSettingsAction';

const props = defineProps<{
    model: PromptSettingsModel;
    actions: JournalystSettingsActions;
}>();

const { error, run, isPending } = useSettingsAction();
const totalPromptCount = computed(() => [
    ...props.model.builtInLibraries,
    ...props.model.customLibraries,
].reduce((total, library) => total + library.promptCount, 0));

function usageLabel(library: PromptLibraryListItem) {
    const parts: string[] = [];
    if (library.journalUsageCount > 0) {
        parts.push(`${library.journalUsageCount} journal${library.journalUsageCount === 1 ? '' : 's'}`);
    }
    if (library.weekdayOverrideCount > 0) {
        parts.push(`${library.weekdayOverrideCount} weekday override${library.weekdayOverrideCount === 1 ? '' : 's'}`);
    }
    return parts.length > 0 ? `Used by ${parts.join(' and ')}` : 'Not currently assigned';
}
</script>

<template>
    <SettingsGroup
        title="Prompts"
        description="Manage reusable prompt libraries. Journals choose sources and delivery in Entry setup."
        icon="hash"
        :status="`${totalPromptCount} ${totalPromptCount === 1 ? 'prompt' : 'prompts'}`"
    >
        <template #actions>
            <ObsidianButton
                variant="cta"
                :disabled="isPending('new')"
                @click="run('new', () => actions.editPromptLibrary())"
            >
                <ObsidianIcon name="plus" />
                New library
            </ObsidianButton>
        </template>

        <AlertCard
            v-if="error"
            class="journalyst-settings-guidance"
            tone="error"
            density="compact"
            icon="circle-alert"
            title="Prompt library could not be changed"
            :description="error"
            role="alert"
        />

        <div class="journalyst-settings-subsection">
            <header>
                <div>
                    <strong>Built-in libraries</strong>
                    <span>Ready to assign without any setup.</span>
                </div>
                <span>{{ model.builtInLibraries.length }}</span>
            </header>
            <div class="journalyst-settings-library-list">
                <div
                    v-for="library in model.builtInLibraries"
                    :key="library.id"
                    class="journalyst-settings-library-row"
                >
                    <span class="journalyst-settings-library-icon"><ObsidianIcon name="bookmark" /></span>
                    <div>
                        <strong>{{ library.name }}</strong>
                        <small>{{ usageLabel(library) }}</small>
                    </div>
                    <span>{{ library.promptCount }} {{ library.promptCount === 1 ? 'prompt' : 'prompts' }}</span>
                </div>
            </div>
        </div>

        <div class="journalyst-settings-subsection">
            <header>
                <div>
                    <strong>Custom libraries</strong>
                    <span>One prompt per line, available to every journal.</span>
                </div>
                <span>{{ model.customLibraries.length }}</span>
            </header>

            <p v-if="model.customLibraries.length === 0" class="journalyst-settings-empty-copy">
                No custom libraries yet. Built-in libraries remain available to every journal.
            </p>

            <div v-else class="journalyst-settings-library-list">
                <div
                    v-for="library in model.customLibraries"
                    :key="library.id"
                    class="journalyst-settings-library-row"
                >
                    <span class="journalyst-settings-library-icon"><ObsidianIcon name="library" /></span>
                    <div>
                        <strong>{{ library.name }}</strong>
                        <small>{{ usageLabel(library) }}</small>
                    </div>
                    <span>{{ library.promptCount }} {{ library.promptCount === 1 ? 'prompt' : 'prompts' }}</span>
                    <div class="journalyst-settings-library-actions">
                        <button
                            type="button"
                            class="clickable-icon"
                            aria-label="Edit prompt library"
                            title="Edit library"
                            :disabled="isPending(`edit-${library.id}`)"
                            @click="run(`edit-${library.id}`, () => actions.editPromptLibrary(library.id))"
                        >
                            <ObsidianIcon name="pencil" />
                        </button>
                        <button
                            type="button"
                            class="clickable-icon is-destructive"
                            aria-label="Delete prompt library"
                            title="Delete library"
                            :disabled="isPending(`delete-${library.id}`)"
                            @click="run(`delete-${library.id}`, () => actions.deletePromptLibrary(library.id))"
                        >
                            <ObsidianIcon name="trash-2" />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="journalyst-settings-group-footer">
            <span>Prompt selection, weekday overrides, and delivery are configured per journal.</span>
            <ObsidianButton @click="actions.openJournalSettings('entry-setup')">
                Manage assignments
                <ObsidianIcon name="arrow-right" />
            </ObsidianButton>
        </div>
    </SettingsGroup>
</template>

<style scoped>
.journalyst-settings-guidance {
    margin: var(--size-4-4);
}

.journalyst-settings-subsection + .journalyst-settings-subsection,
.journalyst-settings-group-footer {
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-settings-subsection > header,
.journalyst-settings-group-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-4);
    padding: var(--size-4-3) var(--size-4-4);
}

.journalyst-settings-subsection > header > div {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-2-1);
}

.journalyst-settings-subsection > header strong {
    color: var(--text-normal);
    font-size: var(--font-ui-small);
}

.journalyst-settings-subsection > header span,
.journalyst-settings-group-footer span {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
}

.journalyst-settings-library-list {
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-settings-library-row {
    display: grid;
    min-width: 0;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: var(--size-4-3);
    padding: var(--size-4-3) var(--size-4-4);
}

.journalyst-settings-library-row + .journalyst-settings-library-row {
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-settings-library-icon {
    display: inline-flex;
    width: 1.75rem;
    height: 1.75rem;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-muted);
}

.journalyst-settings-library-row > div:not(.journalyst-settings-library-actions) {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-2-1);
}

.journalyst-settings-library-row strong {
    overflow: hidden;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-settings-library-row small,
.journalyst-settings-library-row > span:not(.journalyst-settings-library-icon) {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
}

.journalyst-settings-library-actions {
    display: inline-flex;
    gap: var(--size-4-1);
}

.journalyst-settings-library-actions button {
    display: inline-flex;
    width: var(--input-height);
    height: var(--input-height);
    align-items: center;
    justify-content: center;
    padding: 0;
}

.journalyst-settings-library-actions .is-destructive:hover:not(:disabled) {
    color: var(--text-error);
}

.journalyst-settings-empty-copy {
    margin: 0;
    padding: var(--size-4-4);
    border-top: var(--border-width) solid var(--background-modifier-border);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
}

.journalyst-settings-group-footer button {
    display: inline-flex;
    width: auto;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--size-4-2);
}

@container (max-width: 34rem) {
    .journalyst-settings-library-row {
        grid-template-columns: auto minmax(0, 1fr) auto;
    }

    .journalyst-settings-library-row > span:not(.journalyst-settings-library-icon) {
        grid-column: 2;
    }

    .journalyst-settings-library-actions {
        grid-column: 3;
        grid-row: 1 / span 2;
    }

    .journalyst-settings-group-footer {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
