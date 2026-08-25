<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { SidebarMode } from '../../../review/types';
import AlertCard from '../AlertCard.vue';
import ObsidianIcon from '../ObsidianIcon.vue';
import SettingsGroup from './SettingsGroup.vue';
import SettingsRow from './SettingsRow.vue';
import type { JournalystSettingsActions, WorkspaceSettingsModel } from './types';
import { useSettingsAction } from './useSettingsAction';

const props = defineProps<{
    model: WorkspaceSettingsModel;
    actions: JournalystSettingsActions;
}>();

const rootDirectory = ref(props.model.rootDirectory ?? '');
const sidebarMode = ref(props.model.sidebarMode);
const { error, run, isPending } = useSettingsAction();
const selectedRootMissing = computed(() => props.model.folderOptions.some(folder => (
    folder.path === props.model.rootDirectory && folder.missing
)));

watch(() => props.model, model => {
    rootDirectory.value = model.rootDirectory ?? '';
    sidebarMode.value = model.sidebarMode;
});

async function updateRootDirectory(event: Event) {
    const previous = props.model.rootDirectory ?? '';
    rootDirectory.value = (event.target as HTMLSelectElement).value;
    const saved = await run('root', () => props.actions.updateRootDirectory(rootDirectory.value || null));
    if (!saved) rootDirectory.value = previous;
}

async function updateSidebarMode(mode: SidebarMode) {
    const previous = props.model.sidebarMode;
    sidebarMode.value = mode;
    const saved = await run('sidebar', () => props.actions.updateSidebarMode(mode));
    if (!saved) sidebarMode.value = previous;
}
</script>

<template>
    <SettingsGroup
        title="Workspace"
        description="Choose where journals live and what the compact sidebar opens to."
        icon="folder"
        :status="`${model.journalCount} ${model.journalCount === 1 ? 'journal' : 'journals'}`"
    >
        <AlertCard
            v-if="error"
            class="journalyst-settings-guidance"
            tone="error"
            density="compact"
            icon="circle-alert"
            title="Workspace setting could not be saved"
            :description="error"
            role="alert"
        />

        <AlertCard
            v-else-if="selectedRootMissing"
            class="journalyst-settings-guidance"
            tone="warning"
            density="compact"
            icon="folder-x"
            title="The configured home directory is missing"
            description="Choose an existing vault folder. Journalyst will leave the saved path untouched until you select a replacement."
        />

        <SettingsRow
            title="Journalyst home directory"
            description="Each immediate subfolder becomes a journal. Markdown files outside this folder are ignored."
        >
            <select
                v-model="rootDirectory"
                aria-label="Journalyst home directory"
                :disabled="isPending('root')"
                @change="updateRootDirectory"
            >
                <option value="">Not configured</option>
                <option
                    v-for="folder in model.folderOptions"
                    :key="folder.path"
                    :value="folder.path"
                >
                    {{ folder.label }}
                </option>
            </select>
        </SettingsRow>

        <SettingsRow
            title="Sidebar mode"
            description="Choose which compact Journalyst view opens in the Obsidian side pane."
        >
            <div class="journalyst-settings-segmented" role="radiogroup" aria-label="Sidebar mode">
                <button
                    type="button"
                    :class="{ 'is-active': sidebarMode === 'home-mini' }"
                    :aria-pressed="sidebarMode === 'home-mini'"
                    :disabled="isPending('sidebar')"
                    @click="updateSidebarMode('home-mini')"
                >
                    <ObsidianIcon name="house" />
                    Home
                </button>
                <button
                    type="button"
                    :class="{ 'is-active': sidebarMode === 'journals-mini' }"
                    :aria-pressed="sidebarMode === 'journals-mini'"
                    :disabled="isPending('sidebar')"
                    @click="updateSidebarMode('journals-mini')"
                >
                    <ObsidianIcon name="notebook-tabs" />
                    Journals
                </button>
            </div>
        </SettingsRow>
    </SettingsGroup>
</template>

<style scoped>
.journalyst-settings-guidance {
    margin: var(--size-4-4);
}
</style>
