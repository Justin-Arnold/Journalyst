<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { JournalCadenceConfig, JournalSchedulePause } from '../../../cadence';
import type { BasesGenerationTarget } from '../../../bases';
import type {
    JournalAutosaveFeedback,
    JournalAutosaveResult,
    JournalAutosaveSection,
    JournalAutosaveValue,
    JournalEntrySetupUpdate,
    JournalSettingsSection,
    JournalSettingsSidebarItem,
    JournalSettingsViewModel,
} from '../../../journalSettings';
import type { JournalPromptSettings } from '../../../prompts';
import type { JournalReminderSettings } from '../../../reminders';
import ObsidianIcon from '../ObsidianIcon.vue';
import JournalEntrySetupSettings from './JournalEntrySetupSettings.vue';
import JournalEditorHeader from './JournalEditorHeader.vue';
import JournalIntegrationSettings from './JournalIntegrationSettings.vue';
import JournalReminderSettingsEditor from './JournalReminderSettings.vue';
import JournalScheduleSettings from './JournalScheduleSettings.vue';
import JournalsSidebar from './JournalsSidebar.vue';
import type { MainViewActions } from './types';

const props = defineProps<{
    journals: JournalSettingsSidebarItem[];
    model: JournalSettingsViewModel | null;
    loading: boolean;
    error: string;
    activeSection: JournalSettingsSection;
    actions: MainViewActions;
}>();

const emit = defineEmits<{
    pendingChange: [pending: boolean];
    refresh: [];
}>();

const sections: Array<{ id: JournalSettingsSection; label: string; icon: string }> = [
    { id: 'schedule', label: 'Schedule', icon: 'calendar-clock' },
    { id: 'entry-setup', label: 'Entry setup', icon: 'file-cog' },
    { id: 'reminders', label: 'Reminders', icon: 'bell' },
    { id: 'integrations', label: 'Integrations', icon: 'blocks' },
];
const section = ref<JournalSettingsSection>(props.activeSection);
const scheduleDraft = ref<JournalCadenceConfig>({ type: 'daily' });
const schedulePauses = ref<JournalSchedulePause[]>([]);
const templatePathDraft = ref<string | null>(null);
const promptDraft = ref<JournalPromptSettings>({
    enabled: false,
    sourceType: 'built-in',
    selectionMode: 'random',
    deliveryMode: 'append-body',
    weekdayOverrides: {},
    weekdaySourceOverrides: {},
});
const reminderDraft = ref<JournalReminderSettings | null>(null);
const scheduleBaseline = ref<JournalCadenceConfig>({ type: 'daily' });
const entrySetupBaseline = ref<JournalEntrySetupUpdate>({
    templatePath: null,
    promptSettings: clone(promptDraft.value),
});
const reminderBaseline = ref<JournalReminderSettings | null>(null);
const busy = ref(false);
const error = ref('');
const success = ref('');
const renameOpen = ref(false);
const renameDraft = ref('');
const rootEl = ref<HTMLElement | null>(null);
const autosave = ref<JournalAutosaveFeedback>({
    status: 'idle',
    message: 'Changes save automatically.',
    canRetry: false,
    canUndo: false,
});

type AutosaveRequest = {
    journalPath: string;
    section: 'schedule';
    value: JournalCadenceConfig;
} | {
    journalPath: string;
    section: 'entry-setup';
    value: JournalEntrySetupUpdate;
} | {
    journalPath: string;
    section: 'reminders';
    value: JournalReminderSettings;
};

let hydratedJournalPath: string | null = null;
let hydrating = false;
let queuedSave: AutosaveRequest | null = null;
let saveTask: Promise<void> | null = null;
let failedRequest: AutosaveRequest | null = null;
let undoToken: string | null = null;

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function hydrate(model: JournalSettingsViewModel | null, force = false) {
    if (!model) return;
    const journalChanged = hydratedJournalPath !== model.journalPath;
    if (!force && !journalChanged && hasLocalChanges.value) return;

    hydrating = true;
    try {
        scheduleDraft.value = clone(model.cadence);
        scheduleBaseline.value = clone(model.cadence);
        schedulePauses.value = clone(model.schedulePauses);
        templatePathDraft.value = model.templatePath;
        promptDraft.value = clone(model.promptSettings);
        entrySetupBaseline.value = {
            templatePath: model.templatePath,
            promptSettings: clone(model.promptSettings),
        };
        reminderDraft.value = clone(model.reminderSettings);
        reminderBaseline.value = clone(model.reminderSettings);
        renameDraft.value = model.journalName;
        hydratedJournalPath = model.journalPath;
    } finally {
        hydrating = false;
    }

    if (journalChanged || force) resetAutosaveFeedback();
}

watch(() => props.model, model => hydrate(model), { immediate: true });
watch(() => props.activeSection, value => {
    if (!hasLocalChanges.value) section.value = value;
});

const scheduleInvalid = computed(() => (
    scheduleDraft.value.type === 'weekly-days' && (scheduleDraft.value.weekdays?.length ?? 0) === 0
) || (
    scheduleDraft.value.type === 'interval'
    && (!scheduleDraft.value.intervalDays || scheduleDraft.value.intervalDays < 1 || !scheduleDraft.value.startDate)
));

const scheduleDirty = computed(() => !!props.model
    && !isEqual(scheduleDraft.value, scheduleBaseline.value));
const entrySetupDirty = computed(() => !!props.model && (
    templatePathDraft.value !== entrySetupBaseline.value.templatePath
    || !isEqual(promptDraft.value, entrySetupBaseline.value.promptSettings)
));
const remindersDirty = computed(() => !!props.model && !!reminderDraft.value
    && !!reminderBaseline.value
    && !isEqual(reminderDraft.value, reminderBaseline.value));
const hasLocalChanges = computed(() => scheduleDirty.value || entrySetupDirty.value || remindersDirty.value);

watch(hasLocalChanges, value => emit('pendingChange', value), { immediate: true });
watch(scheduleDraft, () => handleDraftEdit('schedule'), { deep: true, flush: 'sync' });
watch([templatePathDraft, promptDraft], () => handleDraftEdit('entry-setup'), { deep: true, flush: 'sync' });
watch(reminderDraft, () => handleDraftEdit('reminders'), { deep: true, flush: 'sync' });

async function changeSection(nextSection: JournalSettingsSection) {
    if (nextSection === section.value) return;
    if (!await prepareToLeave()) return;
    section.value = nextSection;
    clearFeedback();
    if (props.model) {
        await props.actions.activateJournalSettings(props.model.journalPath, nextSection);
    }
}

async function changeJournal(event: Event) {
    const select = event.target as HTMLSelectElement;
    const journalPath = select.value;
    const changed = await selectJournal(journalPath);
    if (!changed) {
        (event.target as HTMLSelectElement).value = props.model?.journalPath ?? '';
    }
}

async function selectJournal(journalPath: string) {
    if (!journalPath || journalPath === props.model?.journalPath) return false;
    if (!await prepareToLeave()) {
        return false;
    }
    clearFeedback();
    await props.actions.activateJournalSettings(journalPath, section.value);
    return true;
}

function commitSchedule() {
    void commitSection('schedule');
}

async function editSchedulePause(pause: JournalSchedulePause | null) {
    if (!props.model || busy.value) return;
    clearFeedback();
    const result = await props.actions.editJournalSchedulePause(props.model.journalPath, pause);
    if (!result) return;
    clearUndo();
    resetAutosaveFeedback();
    if (!result.ok) {
        error.value = result.error;
        return;
    }
    schedulePauses.value = clone(result.pauses);
    success.value = pause ? 'Schedule pause updated.' : 'Schedule pause added.';
}

async function removeSchedulePause(pause: JournalSchedulePause) {
    if (!props.model || busy.value) return;
    clearFeedback();
    const result = await props.actions.removeJournalSchedulePause(props.model.journalPath, pause);
    if (!result) return;
    clearUndo();
    resetAutosaveFeedback();
    if (!result.ok) {
        error.value = result.error;
        return;
    }
    schedulePauses.value = clone(result.pauses);
    success.value = 'Schedule pause removed.';
}

function commitEntrySetup() {
    void commitSection('entry-setup');
}

function commitReminders() {
    void commitSection('reminders');
}

async function commitSection(targetSection: JournalAutosaveSection) {
    const request = buildAutosaveRequest(targetSection);
    if (!request) return;
    clearFeedback();
    clearUndo();

    if (targetSection === 'schedule' && scheduleInvalid.value) {
        failedRequest = null;
        setAutosaveFeedback('invalid', 'Fix the highlighted schedule field to save this change.');
        return;
    }
    if (requestMatchesBaseline(request)) {
        failedRequest = null;
        resetAutosaveFeedback();
        return;
    }

    failedRequest = null;
    queuedSave = request;
    await runAutosaveQueue();
}

function buildAutosaveRequest(targetSection: JournalAutosaveSection): AutosaveRequest | null {
    const journalPath = props.model?.journalPath;
    if (!journalPath) return null;
    if (targetSection === 'schedule') {
        return { journalPath, section: targetSection, value: clone(scheduleDraft.value) };
    }
    if (targetSection === 'entry-setup') {
        return {
            journalPath,
            section: targetSection,
            value: {
                templatePath: templatePathDraft.value,
                promptSettings: clone(promptDraft.value),
            },
        };
    }
    if (!reminderDraft.value) return null;
    return { journalPath, section: targetSection, value: clone(reminderDraft.value) };
}

async function runAutosaveQueue() {
    if (saveTask) return saveTask;
    saveTask = (async () => {
        let savedAny = false;
        while (queuedSave) {
            const request = queuedSave;
            queuedSave = null;
            if (requestMatchesBaseline(request)) continue;

            if (request.journalPath === hydratedJournalPath) {
                setAutosaveFeedback('saving', 'Saving changes...');
            }

            let result: JournalAutosaveResult;
            try {
                result = await performAutosave(request);
            } catch (saveError) {
                result = {
                    ok: false,
                    error: saveError instanceof Error ? saveError.message : 'Journalyst could not save these settings.',
                };
            }

            if (!result.ok) {
                if (queuedSave) continue;
                failedRequest = request;
                if (request.journalPath === hydratedJournalPath) {
                    setAutosaveFeedback('error', `Couldn't save. ${result.error}`, true);
                }
                break;
            }

            savedAny = true;
            applyAutosaveResult(request, result.value);
            if (request.journalPath === hydratedJournalPath) {
                undoToken = result.undoToken;
                setAutosaveFeedback('saved', 'Saved.', false, !!undoToken);
            }
        }

        if (savedAny && !hasLocalChanges.value && !queuedSave) {
            emit('refresh');
        }
    })().finally(() => {
        saveTask = null;
        if (queuedSave) void runAutosaveQueue();
    });
    return saveTask;
}

function performAutosave(request: AutosaveRequest): Promise<JournalAutosaveResult> {
    if (request.section === 'schedule') {
        return props.actions.saveJournalCadence(request.journalPath, request.value);
    }
    if (request.section === 'entry-setup') {
        return props.actions.saveJournalEntrySetup(request.journalPath, request.value);
    }
    return props.actions.saveJournalReminderSettings(request.journalPath, request.value);
}

function applyAutosaveResult(request: AutosaveRequest, value: JournalAutosaveValue) {
    hydrating = true;
    try {
        if (request.section === 'schedule') {
            const canonical = clone(value as JournalCadenceConfig);
            scheduleBaseline.value = canonical;
            if (isEqual(scheduleDraft.value, request.value)) scheduleDraft.value = clone(canonical);
        } else if (request.section === 'entry-setup') {
            const canonical = clone(value as JournalEntrySetupUpdate);
            entrySetupBaseline.value = canonical;
            if (isEqual(getEntrySetupDraft(), request.value)) {
                templatePathDraft.value = canonical.templatePath;
                promptDraft.value = clone(canonical.promptSettings);
            }
        } else {
            const canonical = clone(value as JournalReminderSettings);
            reminderBaseline.value = canonical;
            if (reminderDraft.value && isEqual(reminderDraft.value, request.value)) {
                reminderDraft.value = clone(canonical);
            }
        }
    } finally {
        hydrating = false;
    }
}

function requestMatchesBaseline(request: AutosaveRequest) {
    if (request.section === 'schedule') return isEqual(request.value, scheduleBaseline.value);
    if (request.section === 'entry-setup') return isEqual(request.value, entrySetupBaseline.value);
    return !!reminderBaseline.value && isEqual(request.value, reminderBaseline.value);
}

async function retryAutosave() {
    const request = buildAutosaveRequest(failedRequest?.section ?? section.value as JournalAutosaveSection);
    if (!request) return;
    queuedSave = request;
    failedRequest = null;
    await runAutosaveQueue();
}

async function undoAutosave() {
    const token = undoToken;
    if (!token || saveTask) return;
    setAutosaveFeedback('saving', 'Undoing change...');
    const result = await props.actions.undoJournalSettingsChange(token);
    if (!result.ok) {
        if (!result.canRetry) undoToken = null;
        setAutosaveFeedback('error', `Couldn't undo. ${result.error}`, false, result.canRetry);
        return;
    }

    applyUndoResult(result.section, result.value);
    clearUndo();
    setAutosaveFeedback('saved', 'Change undone.');
    emit('refresh');
}

function applyUndoResult(targetSection: JournalAutosaveSection, value: JournalAutosaveValue) {
    hydrating = true;
    try {
        if (targetSection === 'schedule') {
            const canonical = clone(value as JournalCadenceConfig);
            scheduleDraft.value = clone(canonical);
            scheduleBaseline.value = canonical;
        } else if (targetSection === 'entry-setup') {
            const canonical = clone(value as JournalEntrySetupUpdate);
            templatePathDraft.value = canonical.templatePath;
            promptDraft.value = clone(canonical.promptSettings);
            entrySetupBaseline.value = canonical;
        } else {
            const canonical = clone(value as JournalReminderSettings);
            reminderDraft.value = clone(canonical);
            reminderBaseline.value = canonical;
        }
    } finally {
        hydrating = false;
    }
}

async function prepareToLeave(clearAutosave = true) {
    const saved = await flushAutosave();
    if (saved) {
        if (clearAutosave) {
            clearUndo();
            resetAutosaveFeedback();
        }
        return true;
    }

    const discard = await props.actions.confirmDiscardJournalAutosave();
    if (discard) hydrate(props.model, true);
    return discard;
}

async function flushAutosave() {
    const activeElement = rootEl.value?.ownerDocument.activeElement;
    if (activeElement instanceof HTMLElement && rootEl.value?.contains(activeElement)) activeElement.blur();

    if (section.value !== 'integrations' && hasSectionChanges(section.value)) {
        await commitSection(section.value);
    }
    await waitForAutosave();
    return !hasLocalChanges.value;
}

async function waitForAutosave() {
    while (saveTask || queuedSave) {
        if (!saveTask && queuedSave) void runAutosaveQueue();
        await saveTask;
    }
}

function hasSectionChanges(targetSection: JournalAutosaveSection) {
    if (targetSection === 'schedule') return scheduleDirty.value;
    if (targetSection === 'entry-setup') return entrySetupDirty.value;
    return remindersDirty.value;
}

function handleDraftEdit(targetSection: JournalAutosaveSection) {
    if (hydrating || targetSection !== section.value) return;
    failedRequest = null;
    if (autosave.value.status !== 'saving') {
        setAutosaveFeedback('idle', 'Changes save when you leave the field.', false, !!undoToken);
    }
}

async function renameJournal() {
    if (!props.model || busy.value) return;
    if (!await prepareToLeave(false)) return;
    clearUndo();
    resetAutosaveFeedback();
    busy.value = true;
    clearFeedback();
    try {
        const result = await props.actions.renameJournal(props.model.journalPath, renameDraft.value);
        if (!result.ok) {
            error.value = result.error;
            return;
        }
        renameOpen.value = false;
        success.value = 'Journal renamed.';
        emit('refresh');
    } finally {
        busy.value = false;
    }
}

async function createBase(target: BasesGenerationTarget) {
    if (!props.model || busy.value) return;
    busy.value = true;
    clearFeedback();
    try {
        const result = await props.actions.ensureJournalBase(props.model.journalPath, target);
        if (!result.ok) error.value = result.error;
        else success.value = 'Base is ready. Existing Base files were left unchanged.';
    } catch (actionError) {
        error.value = actionError instanceof Error ? actionError.message : 'Journalyst could not create that Base.';
    } finally {
        busy.value = false;
    }
}

async function resetBase(target: BasesGenerationTarget) {
    if (!props.model || busy.value) return;
    busy.value = true;
    clearFeedback();
    try {
        const result = await props.actions.resetJournalBase(props.model.journalPath, target);
        if (!result) return;
        if (!result.ok) error.value = result.error;
        else success.value = 'Base reset to Journalyst defaults.';
    } catch (actionError) {
        error.value = actionError instanceof Error ? actionError.message : 'Journalyst could not reset that Base.';
    } finally {
        busy.value = false;
    }
}

async function previewBasesBackfill() {
    if (!props.model || busy.value) return;
    busy.value = true;
    clearFeedback();
    try {
        const result = await props.actions.previewJournalBasesBackfill(props.model.journalPath);
        if (!result.ok) {
            error.value = result.error;
        } else if (result.appliedCount > 0) {
            success.value = `Updated Journalyst metadata in ${result.appliedCount} note${result.appliedCount === 1 ? '' : 's'}.`;
        }
    } catch (actionError) {
        error.value = actionError instanceof Error ? actionError.message : 'Journalyst could not review journal metadata.';
    } finally {
        busy.value = false;
    }
}

async function openGlobalReminders() {
    if (!props.model || !await prepareToLeave()) return;
    await props.actions.activateJournalTab(props.model.journalPath, 'reminders');
}

function getEntrySetupDraft(): JournalEntrySetupUpdate {
    return {
        templatePath: templatePathDraft.value,
        promptSettings: promptDraft.value,
    };
}

function setAutosaveFeedback(
    status: JournalAutosaveFeedback['status'],
    message: string,
    canRetry = false,
    canUndo = false,
) {
    autosave.value = { status, message, canRetry, canUndo };
}

function resetAutosaveFeedback() {
    failedRequest = null;
    setAutosaveFeedback('idle', 'Changes save automatically.');
}

function clearUndo() {
    undoToken = null;
    if (autosave.value.canUndo) autosave.value = { ...autosave.value, canUndo: false };
}

function isEqual(left: unknown, right: unknown) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function clearFeedback() {
    error.value = '';
    success.value = '';
}

onBeforeUnmount(() => {
    const canCommit = section.value !== 'schedule' || !scheduleInvalid.value;
    if (section.value !== 'integrations' && hasSectionChanges(section.value) && canCommit) {
        void commitSection(section.value);
    }
    clearUndo();
});

defineExpose({ flushAutosave, prepareToLeave });
</script>

<template>
    <div ref="rootEl" class="journalyst-journal-settings-page">
        <header class="journalyst-journal-settings-page-header">
            <h1>Journal settings</h1>
            <p>Schedule, entry setup, reminders, and integrations for each journal.</p>
        </header>

        <div class="journalyst-journals-workspace">
        <label class="journalyst-journal-mobile-selector">
            <span>Journal</span>
            <select :value="model?.journalPath ?? ''" @change="changeJournal">
                <option v-for="journal in journals" :key="journal.path" :value="journal.path">{{ journal.name }}</option>
            </select>
        </label>

        <JournalsSidebar
            :journals="journals"
            :active-journal-path="model?.journalPath ?? null"
            @select="selectJournal"
            @create="actions.createJournal"
        />

        <section class="journalyst-journal-editor">
            <div v-if="loading && !model" class="journalyst-journal-editor-state" role="status">Loading journal settings…</div>
            <div v-else-if="error && !model" class="journalyst-journal-editor-state is-error" role="alert">{{ error }}</div>
            <div v-else-if="journals.length === 0" class="journalyst-journal-editor-state journalyst-journal-empty" role="status">
                <ObsidianIcon name="folder-plus" />
                <h2>No journals yet</h2>
                <p>Create a journal to start configuring its schedule and entry setup.</p>
                <button type="button" class="mod-cta" @click="actions.createJournal">New journal</button>
            </div>
            <template v-else-if="model">
                <JournalEditorHeader
                    v-model:rename-draft="renameDraft"
                    :model="model"
                    :sections="sections"
                    :active-section="section"
                    :rename-open="renameOpen"
                    :busy="busy"
                    @edit="renameOpen = !renameOpen; renameDraft = model.journalName; clearFeedback()"
                    @cancel-rename="renameOpen = false; clearFeedback()"
                    @rename="renameJournal"
                    @select-section="changeSection"
                />

                <p v-if="error" class="journalyst-journal-feedback is-error" role="alert">{{ error }}</p>
                <p v-else-if="success" class="journalyst-journal-feedback is-success" role="status">{{ success }}</p>

                <JournalScheduleSettings
                    v-if="section === 'schedule'"
                    v-model:cadence="scheduleDraft"
                    class="journalyst-journal-form-section"
                    :model="model"
                    :pauses="schedulePauses"
                    :autosave="autosave"
                    :invalid="scheduleInvalid"
                    @commit="commitSchedule"
                    @retry="retryAutosave"
                    @undo="undoAutosave"
                    @edit-pause="editSchedulePause"
                    @remove-pause="removeSchedulePause"
                />

                <JournalEntrySetupSettings
                    v-else-if="section === 'entry-setup'"
                    v-model:template-path="templatePathDraft"
                    v-model:prompt-settings="promptDraft"
                    :model="model"
                    :actions="actions"
                    :autosave="autosave"
                    @commit="commitEntrySetup"
                    @retry="retryAutosave"
                    @undo="undoAutosave"
                />

                <JournalReminderSettingsEditor
                    v-else-if="section === 'reminders' && reminderDraft"
                    v-model:settings="reminderDraft"
                    class="journalyst-journal-form-section"
                    :model="model"
                    :autosave="autosave"
                    @commit="commitReminders"
                    @retry="retryAutosave"
                    @undo="undoAutosave"
                    @open-global-reminders="openGlobalReminders"
                />

                <JournalIntegrationSettings
                    v-else
                    class="journalyst-journal-form-section"
                    :model="model.bases"
                    :busy="busy"
                    @create-base="createBase"
                    @open-base="actions.openJournalBase"
                    @reset-base="resetBase"
                    @preview-backfill="previewBasesBackfill"
                    @open-plugin-settings="actions.openSettings"
                    @open-core-plugins="actions.openCorePluginsSettings"
                />
            </template>
            </section>
        </div>
    </div>
</template>

<style scoped>
.journalyst-journal-settings-page {
    min-width: 0;
}

.journalyst-journal-settings-page-header {
    display: flex;
    align-items: baseline;
    gap: var(--size-4-4);
    margin-bottom: var(--size-4-5);
    flex-wrap: wrap;
}

.journalyst-journal-settings-page-header h1,
.journalyst-journal-settings-page-header p {
    margin: 0;
}

.journalyst-journal-settings-page-header h1 {
    font-size: var(--h2-size);
}

.journalyst-journal-settings-page-header p {
    color: var(--text-muted);
}

.journalyst-journals-workspace {
    display: grid;
    grid-template-columns: minmax(11rem, 15rem) minmax(0, 1fr);
    gap: var(--size-4-5);
    align-items: stretch;
}

.journalyst-journal-editor {
    min-width: 0;
}

.journalyst-journal-section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-4);
}

.journalyst-journal-section-heading h3 {
    margin: 0;
}

.journalyst-journal-section-heading p {
    margin: var(--size-4-1) 0 0;
    color: var(--text-muted);
}

.journalyst-journal-form-section {
    padding: var(--size-4-5) 0;
}

.journalyst-journal-feedback,
.journalyst-journal-notice {
    padding: var(--size-4-2) var(--size-4-3);
    margin: var(--size-4-3) 0 0;
    border-left: 2px solid var(--background-modifier-border);
    background: var(--background-secondary);
}

.journalyst-journal-feedback.is-error {
    color: var(--text-error);
}

.journalyst-journal-feedback.is-success {
    color: var(--text-success);
}

.journalyst-journal-notice {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-3);
}

.journalyst-journal-mobile-selector {
    display: none;
}

.journalyst-journal-editor-state {
    padding: var(--size-4-6) 0;
    color: var(--text-muted);
}

.journalyst-journal-editor-state.is-error {
    color: var(--text-error);
}

.journalyst-journal-empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-4-2);
}

.journalyst-journal-empty h2,
.journalyst-journal-empty p {
    margin: 0;
}

button:focus-visible,
select:focus-visible,
input:focus-visible,
summary:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@media (max-width: 760px) {
    .journalyst-journals-workspace {
        grid-template-columns: minmax(0, 1fr);
    }

    .journalyst-journal-mobile-selector {
        display: flex;
        flex-direction: column;
        gap: var(--size-4-1);
    }
}

@media (max-width: 520px) {
    .journalyst-journal-section-heading,
    .journalyst-journal-notice {
        align-items: flex-start;
        flex-direction: column;
    }

    .journalyst-journal-section-heading button {
        width: 100%;
    }
}
</style>
