<script setup lang="ts">
import { computed } from 'vue';
import type {
    BasesGenerationTarget,
    JournalBaseResource,
    JournalBasesIntegrationModel,
} from '../../../bases';
import AlertCard from '../AlertCard.vue';
import ObsidianIcon from '../ObsidianIcon.vue';

const props = defineProps<{
    model: JournalBasesIntegrationModel;
    busy: boolean;
}>();

const emit = defineEmits<{
    createBase: [target: BasesGenerationTarget];
    openBase: [filePath: string];
    resetBase: [target: BasesGenerationTarget];
    previewBackfill: [];
    openPluginSettings: [];
    openCorePlugins: [];
}>();

const statusLabel = computed(() => ({
    off: 'Off',
    unavailable: 'Unavailable',
    'setup-needed': 'Setup needed',
    partial: 'Partial',
    ready: 'Ready',
}[props.model.status]));

const canManageBases = computed(() => props.model.globalEnabled && props.model.corePluginAvailable);
const metadataDescription = computed(() => {
    if (!props.model.globalEnabled) {
        return 'Enable Bases integration to check existing notes for Journalyst metadata.';
    }
    if (props.model.recognizedNoteCount === 0) {
        return 'No recognized notes are available to update.';
    }
    if (props.model.backfillCount === 0) {
        return 'Every recognized note has the current Journalyst metadata.';
    }
    return `${props.model.backfillCount} note${props.model.backfillCount === 1 ? '' : 's'} need metadata. Preview changes before updating any note frontmatter.`;
});

function resourceStatusLabel(resource: JournalBaseResource) {
    if (resource.status === 'ready') return 'Created';
    if (resource.status === 'conflict') return 'Path conflict';
    return 'Missing';
}
</script>

<template>
    <div class="journalyst-journal-bases-settings">
        <section class="journalyst-bases-block">
            <header class="journalyst-bases-header">
                <span class="journalyst-bases-title">
                    <ObsidianIcon name="database" />
                    <span>Obsidian Bases</span>
                </span>
                <span class="journalyst-bases-status" :class="`is-${model.status}`">
                    {{ statusLabel }}
                </span>
            </header>

            <AlertCard
                v-if="!model.globalEnabled"
                class="journalyst-bases-guidance"
                tone="warning"
                density="compact"
                icon="circle-alert"
                title="Bases integration is off"
                description="Enable it globally before Journalyst creates Base files or adds metadata to new entries."
            >
                <template #actions>
                    <button type="button" @click="emit('openPluginSettings')">Open settings</button>
                </template>
            </AlertCard>
            <AlertCard
                v-else-if="!model.corePluginAvailable"
                class="journalyst-bases-guidance"
                tone="warning"
                density="compact"
                icon="circle-alert"
                title="The Bases core plugin is unavailable"
                description="Enable Bases in Obsidian before creating or opening Journalyst's starter views."
            >
                <template #actions>
                    <button type="button" @click="emit('openCorePlugins')">Open Core plugins</button>
                </template>
            </AlertCard>
            <p v-else class="journalyst-bases-intro">
                Journalyst supplies starter views over local journal properties. Once created, each Base is yours to customize.
            </p>
        </section>

        <section class="journalyst-bases-block">
            <header class="journalyst-bases-subheader">
                <span>
                    <ObsidianIcon name="table-properties" />
                    <span>Base files</span>
                </span>
                <span>Existing files are never replaced automatically</span>
            </header>

            <div class="journalyst-bases-resources">
                <article v-for="resource in model.resources" :key="resource.target" class="journalyst-bases-resource">
                    <div class="journalyst-bases-resource-icon">
                        <ObsidianIcon :name="resource.target === 'entries' ? 'notebook-tabs' : 'files'" />
                    </div>
                    <div class="journalyst-bases-resource-copy">
                        <div class="journalyst-bases-resource-heading">
                            <h4>{{ resource.label }}</h4>
                            <span class="journalyst-bases-resource-status" :class="`is-${resource.status}`">
                                {{ resourceStatusLabel(resource) }}
                            </span>
                        </div>
                        <p>{{ resource.description }}</p>
                        <code :title="resource.filePath">{{ resource.filePath }}</code>
                        <p v-if="resource.status === 'conflict'" class="journalyst-bases-conflict" role="alert">
                            A folder already occupies this file path.
                        </p>
                    </div>
                    <div class="journalyst-bases-resource-actions">
                        <button
                            v-if="resource.status === 'missing'"
                            type="button"
                            :disabled="busy || !canManageBases"
                            @click="emit('createBase', resource.target)"
                        >
                            <ObsidianIcon name="plus" />
                            Create
                        </button>
                        <template v-else-if="resource.status === 'ready'">
                            <button type="button" :disabled="busy || !model.corePluginAvailable" @click="emit('openBase', resource.filePath)">
                                <ObsidianIcon name="external-link" />
                                Open
                            </button>
                            <button
                                type="button"
                                class="journalyst-bases-reset"
                                :disabled="busy || !canManageBases"
                                :aria-label="`Reset ${resource.label} Base to Journalyst defaults`"
                                title="Reset to Journalyst defaults"
                                @click="emit('resetBase', resource.target)"
                            >
                                <ObsidianIcon name="rotate-ccw" />
                            </button>
                        </template>
                    </div>
                </article>
            </div>
        </section>

        <section class="journalyst-bases-block">
            <header class="journalyst-bases-subheader">
                <span>
                    <ObsidianIcon name="tags" />
                    <span>Managed properties</span>
                </span>
            </header>
            <div class="journalyst-bases-property-row">
                <div>
                    <h4>Journalyst metadata</h4>
                    <p>Custom properties from your templates remain available to Bases and are never removed or managed by Journalyst.</p>
                </div>
                <div class="journalyst-bases-property-list" aria-label="Journalyst managed properties">
                    <span
                        v-for="property in model.managedProperties"
                        :key="property.key"
                        :title="property.key"
                    >
                        {{ property.label }}
                    </span>
                </div>
            </div>
        </section>

        <section class="journalyst-bases-block">
            <header class="journalyst-bases-subheader">
                <span>
                    <ObsidianIcon name="history" />
                    <span>Existing notes</span>
                </span>
            </header>
            <div class="journalyst-bases-backfill-row">
                <div>
                    <h4>Journal metadata</h4>
                    <p>{{ metadataDescription }}</p>
                </div>
                <button
                    type="button"
                    :disabled="busy || !canManageBases || model.recognizedNoteCount === 0"
                    @click="emit('previewBackfill')"
                >
                    <ObsidianIcon name="search" />
                    Preview
                </button>
            </div>
        </section>
    </div>
</template>

<style scoped>
.journalyst-journal-bases-settings,
.journalyst-bases-block,
.journalyst-bases-resources {
    display: flex;
    min-width: 0;
    flex-direction: column;
}

.journalyst-journal-bases-settings {
    gap: var(--size-4-6);
    container-type: inline-size;
}

.journalyst-bases-header,
.journalyst-bases-subheader,
.journalyst-bases-title,
.journalyst-bases-subheader > span,
.journalyst-bases-resource,
.journalyst-bases-resource-heading,
.journalyst-bases-resource-actions,
.journalyst-bases-backfill-row {
    display: flex;
    align-items: center;
}

.journalyst-bases-header,
.journalyst-bases-subheader {
    min-height: var(--input-height);
    justify-content: space-between;
    gap: var(--size-4-3);
    padding-bottom: var(--size-4-2);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    flex-wrap: wrap;
}

.journalyst-bases-title,
.journalyst-bases-subheader > span:first-child {
    gap: var(--size-4-2);
    text-transform: uppercase;
}

.journalyst-bases-status,
.journalyst-bases-resource-status,
.journalyst-bases-property-list span {
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    font-size: var(--font-ui-smaller);
}

.journalyst-bases-status {
    padding: var(--size-2-1) var(--size-4-2);
    color: var(--text-muted);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
}

.journalyst-bases-status.is-ready,
.journalyst-bases-resource-status.is-ready {
    color: var(--text-success);
}

.journalyst-bases-status.is-partial,
.journalyst-bases-status.is-setup-needed,
.journalyst-bases-resource-status.is-missing {
    color: var(--text-warning);
}

.journalyst-bases-status.is-unavailable,
.journalyst-bases-resource-status.is-conflict,
.journalyst-bases-conflict {
    color: var(--text-error);
}

.journalyst-bases-intro {
    margin: var(--size-4-3) var(--size-4-1) 0;
    color: var(--text-muted);
}

.journalyst-bases-guidance {
    margin-top: var(--size-4-3);
}

.journalyst-bases-resource-copy p,
.journalyst-bases-property-row p,
.journalyst-bases-backfill-row p {
    margin: var(--size-4-1) 0 0;
    color: var(--text-muted);
}

.journalyst-bases-subheader > span:last-child:not(:first-child) {
    color: var(--text-faint);
}

.journalyst-bases-resource {
    min-width: 0;
    align-items: flex-start;
    gap: var(--size-4-3);
    padding: var(--size-4-4) var(--size-4-1);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-bases-resource-icon {
    display: flex;
    width: var(--input-height);
    height: var(--input-height);
    flex: 0 0 var(--input-height);
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-accent);
}

.journalyst-bases-resource-copy {
    min-width: 0;
    flex: 1 1 auto;
}

.journalyst-bases-resource-heading {
    gap: var(--size-4-2);
    flex-wrap: wrap;
}

.journalyst-bases-resource h4,
.journalyst-bases-property-row h4,
.journalyst-bases-backfill-row h4 {
    margin: 0;
}

.journalyst-bases-resource-status {
    padding: var(--size-2-1) var(--size-4-2);
    color: var(--text-muted);
}

.journalyst-bases-resource code {
    display: block;
    max-width: 100%;
    margin-top: var(--size-4-2);
    overflow: hidden;
    color: var(--text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-bases-conflict {
    font-size: var(--font-ui-smaller);
}

.journalyst-bases-resource-actions {
    flex: 0 0 auto;
    gap: var(--size-4-2);
}

.journalyst-bases-resource-actions button,
.journalyst-bases-backfill-row button {
    display: inline-flex;
    width: auto;
    align-items: center;
    gap: var(--size-4-1);
}

.journalyst-bases-resource-actions .journalyst-bases-reset {
    width: var(--input-height);
    height: var(--input-height);
    justify-content: center;
    padding: 0;
}

.journalyst-bases-property-row {
    display: grid;
    grid-template-columns: minmax(12rem, 0.8fr) minmax(0, 1.2fr);
    gap: var(--size-4-4);
    padding: var(--size-4-4) var(--size-4-1);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-bases-property-list {
    display: flex;
    min-width: 0;
    justify-content: flex-end;
    gap: var(--size-4-2);
    flex-wrap: wrap;
}

.journalyst-bases-property-list span {
    padding: var(--size-4-1) var(--size-4-2);
    color: var(--text-muted);
}

.journalyst-bases-backfill-row {
    min-width: 0;
    justify-content: space-between;
    gap: var(--size-4-4);
    padding: var(--size-4-4) var(--size-4-1);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-bases-backfill-row > div {
    min-width: 0;
}

button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@container (max-width: 36rem) {
    .journalyst-bases-resource,
    .journalyst-bases-backfill-row {
        align-items: stretch;
        flex-direction: column;
    }

    .journalyst-bases-resource-actions {
        justify-content: flex-end;
    }

    .journalyst-bases-property-row {
        grid-template-columns: minmax(0, 1fr);
    }

    .journalyst-bases-property-list {
        justify-content: flex-start;
    }
}

@container (max-width: 24rem) {
    .journalyst-bases-header,
    .journalyst-bases-subheader {
        align-items: flex-start;
        flex-direction: column;
    }

    .journalyst-bases-resource-actions button:not(.journalyst-bases-reset),
    .journalyst-bases-backfill-row button {
        width: 100%;
        justify-content: center;
    }
}
</style>
