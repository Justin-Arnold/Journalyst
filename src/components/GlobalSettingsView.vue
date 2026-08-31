<script setup lang="ts">
import AlertCard from './AlertCard.vue';
import ObsidianButton from './ObsidianButton.vue';
import ObsidianIcon from './ObsidianIcon.vue';
import BasesSettings from './settings/BasesSettings.vue';
import NoteFileSettings from './settings/NoteFileSettings.vue';
import PromptLibrarySettings from './settings/PromptLibrarySettings.vue';
import ReminderSettings from './settings/ReminderSettings.vue';
import TemplateSettings from './settings/TemplateSettings.vue';
import type { JournalystSettingsActions, JournalystSettingsViewState } from './settings/types';
import WorkspaceSettings from './settings/WorkspaceSettings.vue';

defineProps<{
    state: JournalystSettingsViewState;
    actions: JournalystSettingsActions;
}>();
</script>

<template>
    <main class="journalyst-global-settings">
        <header class="journalyst-global-settings-header">
            <div>
                <h1 class="journalyst-type-page-title">Journalyst settings</h1>
                <p class="journalyst-type-supporting">Workspace, reminders, note files, prompts, templates, and Bases integration.</p>
            </div>
            <div class="setting-item-control journalyst-global-settings-header-actions">
                <ObsidianButton variant="cta" @click="actions.openJournalSettings()">
                    <ObsidianIcon name="notebook-tabs" />
                    Manage journals
                </ObsidianButton>
            </div>
        </header>

        <AlertCard
            v-if="state.error"
            tone="error"
            density="compact"
            icon="circle-alert"
            title="Settings could not be loaded"
            :description="state.error"
            role="alert"
        >
            <template #actions>
                <ObsidianButton @click="actions.reload()">Retry</ObsidianButton>
            </template>
        </AlertCard>

        <AlertCard
            v-else-if="state.loading && !state.model"
            tone="accent"
            density="compact"
            icon="loader-circle"
            icon-class="journalyst-spin"
            title="Loading Journalyst settings"
            role="status"
            aria-live="polite"
        />

        <div v-if="state.model" class="journalyst-global-settings-groups" :aria-busy="state.loading">
            <WorkspaceSettings :model="state.model.workspace" :actions="actions" />
            <ReminderSettings :model="state.model.reminders" :actions="actions" />
            <NoteFileSettings :model="state.model.notes" :actions="actions" />
            <PromptLibrarySettings :model="state.model.prompts" :actions="actions" />
            <TemplateSettings :model="state.model.templates" :actions="actions" />
            <BasesSettings :model="state.model.bases" :actions="actions" />
        </div>
    </main>
</template>

<style scoped>
.journalyst-global-settings {
    display: flex;
    width: min(100%, 64rem);
    min-width: 0;
    flex-direction: column;
    gap: var(--size-4-5);
    padding: var(--size-4-2) 0 var(--size-4-12);
}

.journalyst-global-settings-header {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--size-4-6);
}

.journalyst-global-settings-header > div {
    min-width: 0;
}

.journalyst-global-settings-header h1 {
    margin: 0;
    color: var(--text-normal);
}

.journalyst-global-settings-header p {
    margin: var(--size-4-1) 0 0;
    color: var(--text-muted);
}

.journalyst-global-settings-header-actions {
    flex: 0 0 auto;
}

.journalyst-global-settings-header-actions button {
    display: inline-flex;
    width: auto;
    align-items: center;
    gap: var(--size-4-2);
}

.journalyst-global-settings-groups {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-4-5);
}

.journalyst-global-settings :deep(.journalyst-spin) {
    animation: journalyst-global-settings-spin 0.8s linear infinite;
}

@keyframes journalyst-global-settings-spin {
    to {
        transform: rotate(360deg);
    }
}

@media (max-width: 700px) {
    .journalyst-global-settings-header {
        align-items: stretch;
        flex-direction: column;
        gap: var(--size-4-3);
    }

    .journalyst-global-settings-header-actions {
        align-self: flex-start;
    }
}
</style>
