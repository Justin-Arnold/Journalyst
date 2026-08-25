<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TemplateEngine, TemplateFailureBehavior } from '../../../templates/types';
import AlertCard from '../AlertCard.vue';
import ObsidianIcon from '../ObsidianIcon.vue';
import SettingsGroup from './SettingsGroup.vue';
import SettingsRow from './SettingsRow.vue';
import type { JournalystSettingsActions, TemplateSettingsModel } from './types';
import { useSettingsAction } from './useSettingsAction';

const props = defineProps<{
    model: TemplateSettingsModel;
    actions: JournalystSettingsActions;
}>();

const engine = ref(props.model.engine);
const failureBehavior = ref(props.model.failureBehavior);
const { error, run, isPending } = useSettingsAction();

const status = computed(() => {
    if (props.model.engine === 'none') return { label: 'Off', tone: 'neutral' as const };
    if (props.model.availability === 'ready') return { label: 'Ready', tone: 'success' as const };
    return { label: 'Unavailable', tone: 'warning' as const };
});

const availabilityGuidance = computed(() => {
    if (props.model.engine === 'none') {
        return {
            tone: 'neutral' as const,
            icon: 'info',
            title: 'Journalyst default entries are active',
            description: 'New entries use Journalyst frontmatter and prompt output without running a template engine.',
        };
    }
    if (props.model.availability === 'ready') {
        return {
            tone: 'success' as const,
            icon: 'circle-check',
            title: props.model.engine === 'core' ? 'Core Templates is ready' : 'Templater is ready',
            description: 'Per-journal template assignments are available in each journal\'s Entry setup section.',
        };
    }
    if (props.model.availability === 'not-installed') {
        return {
            tone: 'warning' as const,
            icon: 'circle-alert',
            title: 'Templater is not installed',
            description: 'Install Templater or choose another engine before assigned templates can run.',
        };
    }
    if (props.model.availability === 'disabled') {
        return {
            tone: 'warning' as const,
            icon: 'circle-alert',
            title: `${props.model.engine === 'core' ? 'Core Templates' : 'Templater'} is disabled`,
            description: 'Enable the selected plugin in Obsidian before assigned templates can run.',
        };
    }
    return {
        tone: 'warning' as const,
        icon: 'folder-x',
        title: 'Template folder is not configured',
        description: 'Choose a template folder in the selected template plugin before assigning files to journals.',
    };
});

watch(() => props.model, model => {
    engine.value = model.engine;
    failureBehavior.value = model.failureBehavior;
});

async function updateEngine(nextEngine: TemplateEngine) {
    const previous = props.model.engine;
    engine.value = nextEngine;
    const saved = await run('engine', () => props.actions.updateTemplateEngine(nextEngine));
    if (!saved) engine.value = previous;
}

async function updateFailureBehavior(event: Event) {
    const previous = props.model.failureBehavior;
    const value = (event.target as HTMLSelectElement).value as TemplateFailureBehavior;
    failureBehavior.value = value;
    const saved = await run('fallback', () => props.actions.updateTemplateFailureBehavior(value));
    if (!saved) failureBehavior.value = previous;
}
</script>

<template>
    <SettingsGroup
        title="Templates"
        description="Choose the plugin-wide template engine and what happens when an assigned template cannot run."
        icon="file-code-2"
        :status="status.label"
        :status-tone="status.tone"
    >
        <AlertCard
            v-if="error"
            class="journalyst-settings-guidance"
            tone="error"
            density="compact"
            icon="circle-alert"
            title="Template setting could not be saved"
            :description="error"
            role="alert"
        />

        <SettingsRow
            title="Template engine"
            description="Choose which Obsidian template integration Journalyst uses when creating entries."
        >
            <div class="journalyst-settings-segmented" role="radiogroup" aria-label="Template engine">
                <button
                    v-for="option in ([
                        { value: 'none', label: 'None' },
                        { value: 'core', label: 'Core' },
                        { value: 'templater', label: 'Templater' },
                    ] as const)"
                    :key="option.value"
                    type="button"
                    :class="{ 'is-active': engine === option.value }"
                    :aria-pressed="engine === option.value"
                    :disabled="isPending('engine')"
                    @click="updateEngine(option.value)"
                >
                    {{ option.label }}
                </button>
            </div>
        </SettingsRow>

        <SettingsRow
            title="Fallback behavior"
            description="Choose what Journalyst does when an assigned template is missing or its engine is unavailable."
        >
            <select
                v-model="failureBehavior"
                aria-label="Template fallback behavior"
                :disabled="isPending('fallback')"
                @change="updateFailureBehavior"
            >
                <option value="fallback-default">Create Journalyst's default entry</option>
                <option value="abort">Abort entry creation</option>
            </select>
        </SettingsRow>

        <div class="journalyst-settings-guidance-wrap">
            <AlertCard
                :tone="availabilityGuidance.tone"
                density="compact"
                :icon="availabilityGuidance.icon"
                :title="availabilityGuidance.title"
                :description="availabilityGuidance.description"
            >
                <template #actions>
                    <button type="button" @click="actions.openJournalSettings('entry-setup')">
                        Manage assignments
                        <ObsidianIcon name="arrow-right" />
                    </button>
                </template>
            </AlertCard>
        </div>
    </SettingsGroup>
</template>

<style scoped>
.journalyst-settings-guidance {
    margin: var(--size-4-4);
}

.journalyst-settings-guidance-wrap {
    padding: var(--size-4-4);
    border-top: var(--border-width) solid var(--background-modifier-border);
}
</style>
