<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AlertCard from '../AlertCard.vue';
import ObsidianButton from '../ObsidianButton.vue';
import ObsidianIcon from '../ObsidianIcon.vue';
import ObsidianToggle from '../ObsidianToggle.vue';
import SettingsGroup from './SettingsGroup.vue';
import SettingsRow from './SettingsRow.vue';
import type { BasesSettingsModel, JournalystSettingsActions } from './types';
import { useSettingsAction } from './useSettingsAction';

const props = defineProps<{
    model: BasesSettingsModel;
    actions: JournalystSettingsActions;
}>();

const enabled = ref(props.model.enabled);
const { error, run, isPending } = useSettingsAction();
const status = computed(() => {
    if (!props.model.enabled) return { label: 'Off', tone: 'neutral' as const };
    if (!props.model.corePluginAvailable) return { label: 'Unavailable', tone: 'warning' as const };
    return { label: 'Enabled', tone: 'success' as const };
});
const missingResourceCount = computed(() => Math.max(
    0,
    props.model.totalResourceCount - props.model.readyResourceCount - props.model.conflictCount,
));
const resourcesDescription = computed(() => {
    if (props.model.totalResourceCount === 0) return 'Create a journal before generating starter Base files.';
    if (props.model.conflictCount > 0) {
        return `${props.model.conflictCount} Base ${props.model.conflictCount === 1 ? 'path has' : 'paths have'} a file or folder conflict.`;
    }
    if (missingResourceCount.value === 0) return 'Every journal has both Journalyst starter Base files.';
    return `${missingResourceCount.value} starter ${missingResourceCount.value === 1 ? 'Base is' : 'Bases are'} missing across the vault.`;
});

watch(() => props.model.enabled, value => {
    enabled.value = value;
});

async function updateEnabled(value: boolean) {
    const previous = props.model.enabled;
    enabled.value = value;
    const saved = await run('enabled', () => props.actions.updateBasesEnabled(value));
    if (!saved) enabled.value = previous;
}
</script>

<template>
    <SettingsGroup
        title="Bases"
        description="Expose stable Journalyst metadata to customizable Obsidian Base views."
        icon="database"
        :status="status.label"
        :status-tone="status.tone"
    >
        <AlertCard
            v-if="error"
            class="journalyst-settings-guidance"
            tone="error"
            density="compact"
            icon="circle-alert"
            title="Bases operation could not be completed"
            :description="error"
            role="alert"
        />

        <AlertCard
            v-else-if="model.enabled && !model.corePluginAvailable"
            class="journalyst-settings-guidance"
            tone="warning"
            density="compact"
            icon="circle-alert"
            title="The Bases core plugin is unavailable"
            description="Enable Bases in Obsidian before Journalyst creates starter views or opens integrations."
        >
            <template #actions>
                <ObsidianButton @click="actions.openCorePluginsSettings()">Open Core plugins</ObsidianButton>
            </template>
        </AlertCard>

        <AlertCard
            v-else-if="model.conflictCount > 0"
            class="journalyst-settings-guidance"
            tone="error"
            density="compact"
            icon="folder-x"
            title="Some starter Base paths are occupied"
            :description="`${model.conflictCount} expected Base ${model.conflictCount === 1 ? 'path has' : 'paths have'} a file or folder conflict. Open journal integrations to review the affected paths.`"
        >
            <template #actions>
                <ObsidianButton @click="actions.openJournalSettings('integrations')">Manage integrations</ObsidianButton>
            </template>
        </AlertCard>

        <SettingsRow
            title="Enable Bases integration"
            description="Add Journalyst metadata to new notes and allow starter Base files to be generated per journal."
        >
            <ObsidianToggle
                :model-value="enabled"
                :disabled="isPending('enabled')"
                label="Enable Journalyst Bases integration"
                @update:model-value="updateEnabled"
            />
        </SettingsRow>

        <SettingsRow
            title="Starter Base files"
            :description="resourcesDescription"
        >
            <span class="journalyst-settings-resource-count">
                {{ model.readyResourceCount }} of {{ model.totalResourceCount }} ready
            </span>
            <ObsidianButton
                variant="cta"
                :disabled="!model.enabled || !model.corePluginAvailable || missingResourceCount === 0 || isPending('create')"
                @click="run('create', actions.createMissingBases)"
            >
                <ObsidianIcon name="plus" />
                Create missing
            </ObsidianButton>
        </SettingsRow>

        <SettingsRow
            title="Managed properties"
            description="Journalyst updates only these fields. Custom properties and Base columns remain yours."
        >
            <div class="journalyst-settings-property-list" aria-label="Journalyst managed properties">
                <code v-for="property in model.managedProperties" :key="property.key" :title="property.key">
                    {{ property.label }}
                </code>
            </div>
        </SettingsRow>

        <SettingsRow
            title="Existing note metadata"
            description="Preview missing or changed Journalyst properties across every recognized journal note before applying them."
        >
            <ObsidianButton
                :disabled="!model.enabled || isPending('backfill')"
                @click="run('backfill', actions.previewBasesBackfill)"
            >
                <ObsidianIcon name="search" />
                Preview metadata
            </ObsidianButton>
        </SettingsRow>

        <div class="journalyst-settings-group-footer">
            <span>Base files are managed per journal and existing files are never replaced automatically.</span>
            <ObsidianButton @click="actions.openJournalSettings('integrations')">
                Manage integrations
                <ObsidianIcon name="arrow-right" />
            </ObsidianButton>
        </div>
    </SettingsGroup>
</template>

<style scoped>
.journalyst-settings-guidance {
    margin: var(--size-4-4);
}

.journalyst-settings-resource-count {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
}

.journalyst-settings-property-list {
    display: flex;
    max-width: 30rem;
    justify-content: flex-end;
    gap: var(--size-4-1);
    flex-wrap: wrap;
}

.journalyst-settings-property-list code {
    padding: var(--size-2-1) var(--size-4-2);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
}

.journalyst-settings-group-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-4);
    padding: var(--size-4-3) var(--size-4-4);
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-settings-group-footer span {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
}

.journalyst-settings-group-footer button {
    display: inline-flex;
    width: auto;
    flex: 0 0 auto;
    align-items: center;
    gap: var(--size-4-2);
}

@container (max-width: 34rem) {
    .journalyst-settings-property-list {
        justify-content: flex-start;
    }

    .journalyst-settings-group-footer {
        align-items: flex-start;
        flex-direction: column;
    }
}
</style>
