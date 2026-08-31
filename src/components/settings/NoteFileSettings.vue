<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AlertCard from '../AlertCard.vue';
import ObsidianButton from '../ObsidianButton.vue';
import ObsidianIcon from '../ObsidianIcon.vue';
import ObsidianInput from '../ObsidianInput.vue';
import SettingsGroup from './SettingsGroup.vue';
import SettingsRow from './SettingsRow.vue';
import type { JournalystSettingsActions, NoteFileSettingsModel } from './types';
import { useSettingsAction } from './useSettingsAction';

const props = defineProps<{
    model: NoteFileSettingsModel;
    actions: JournalystSettingsActions;
}>();

const dateFormatDraft = ref(props.model.dateFormat);
const { error, run, isPending } = useSettingsAction();
const example = computed(() => props.actions.getNoteFileNameExample(dateFormatDraft.value));
const formatChanged = computed(() => dateFormatDraft.value.trim() !== props.model.dateFormat);

watch(() => props.model.dateFormat, format => {
    dateFormatDraft.value = format;
});

async function saveFormat() {
    await run('format', () => props.actions.saveNoteDateFormat(dateFormatDraft.value.trim()));
}

async function previewMigration() {
    await run('migration', () => props.actions.previewNoteMigration(dateFormatDraft.value.trim()));
}
</script>

<template>
    <SettingsGroup
        title="Notes and files"
        description="Control new entry filenames and safely preview changes to existing notes."
        icon="file-cog"
    >
        <AlertCard
            v-if="error"
            class="journalyst-settings-guidance"
            tone="error"
            density="compact"
            icon="circle-alert"
            title="Note setting could not be applied"
            :description="error"
            role="alert"
        />

        <SettingsRow
            title="Journal note date format"
            description="Used for new entry filenames and daily headings. Format changes do not rename existing notes automatically."
        >
            <div class="journalyst-settings-format-control">
                <ObsidianInput
                    v-model="dateFormatDraft"
                    type="text"
                    aria-label="Journal note date format"
                    placeholder="YYYY-MM-DD"
                    :disabled="isPending('format')"
                    @keydown.enter.prevent="saveFormat"
                />
                <code>{{ example }}</code>
                <ObsidianButton
                    variant="cta"
                    :disabled="!dateFormatDraft.trim() || !formatChanged || isPending('format')"
                    @click="saveFormat"
                >
                    Save format
                </ObsidianButton>
            </div>
        </SettingsRow>

        <SettingsRow
            title="Existing filenames"
            description="Preview every proposed rename and resolve path conflicts before Journalyst changes any files."
        >
            <ObsidianButton
                variant="cta"
                :disabled="!dateFormatDraft.trim() || isPending('migration')"
                @click="previewMigration"
            >
                <ObsidianIcon name="search" />
                Preview migration
            </ObsidianButton>
        </SettingsRow>
    </SettingsGroup>
</template>

<style scoped>
.journalyst-settings-guidance {
    margin: var(--size-4-4);
}

.journalyst-settings-format-control {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: flex-end;
    gap: var(--size-4-2);
    flex-wrap: wrap;
}

.journalyst-settings-format-control input {
    width: 12rem;
}

.journalyst-settings-format-control code {
    max-width: 14rem;
    overflow: hidden;
    padding: var(--size-4-1) var(--size-4-2);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
