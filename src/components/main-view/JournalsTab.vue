<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { JournalCadenceConfig, JournalSchedulePause } from '../../../cadence';
import type {
    JournalSettingsSection,
    JournalSettingsSidebarItem,
    JournalSettingsViewModel,
} from '../../../journalSettings';
import type { JournalPromptSettings } from '../../../prompts';
import type { JournalReminderSettings } from '../../../reminders';
import ObsidianIcon from '../ObsidianIcon.vue';
import JournalEditorHeader from './JournalEditorHeader.vue';
import JournalScheduleSettings from './JournalScheduleSettings.vue';
import JournalsSidebar from './JournalsSidebar.vue';
import ReminderRuleEditor from './ReminderRuleEditor.vue';
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
    dirtyChange: [dirty: boolean];
    refresh: [];
}>();

const sections: Array<{ id: JournalSettingsSection; label: string; icon: string }> = [
    { id: 'schedule', label: 'Schedule', icon: 'calendar-clock' },
    { id: 'entry-setup', label: 'Entry setup', icon: 'file-cog' },
    { id: 'reminders', label: 'Reminders', icon: 'bell' },
    { id: 'integrations', label: 'Integrations', icon: 'blocks' },
];
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
});
const reminderDraft = ref<JournalReminderSettings | null>(null);
const promptOptions = ref(props.model?.promptOptions ?? []);
const promptOptionsLoading = ref(false);
const busy = ref(false);
const error = ref('');
const success = ref('');
const renameOpen = ref(false);
const renameDraft = ref('');
let promptRequestRevision = 0;

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function hydrate(model: JournalSettingsViewModel | null) {
    if (!model) return;
    scheduleDraft.value = clone(model.cadence);
    schedulePauses.value = clone(model.schedulePauses);
    templatePathDraft.value = model.templatePath;
    promptDraft.value = clone(model.promptSettings);
    reminderDraft.value = clone(model.reminderSettings);
    promptOptions.value = clone(model.promptOptions);
    renameDraft.value = model.journalName;
}

watch(() => props.model, hydrate, { immediate: true });
watch(() => props.activeSection, value => {
    if (!isDirty.value) section.value = value;
});

const scheduleInvalid = computed(() => (
    scheduleDraft.value.type === 'weekly-days' && (scheduleDraft.value.weekdays?.length ?? 0) === 0
) || (
    scheduleDraft.value.type === 'interval'
    && (!scheduleDraft.value.intervalDays || scheduleDraft.value.intervalDays < 1 || !scheduleDraft.value.startDate)
));

const scheduleDirty = computed(() => !!props.model
    && JSON.stringify(scheduleDraft.value) !== JSON.stringify(props.model.cadence));
const entrySetupDirty = computed(() => !!props.model && (
    templatePathDraft.value !== props.model.templatePath
    || JSON.stringify(promptDraft.value) !== JSON.stringify(props.model.promptSettings)
));
const remindersDirty = computed(() => !!props.model && !!reminderDraft.value
    && JSON.stringify(reminderDraft.value) !== JSON.stringify(props.model.reminderSettings));
const isDirty = computed(() => section.value === 'schedule'
    ? scheduleDirty.value
    : section.value === 'entry-setup'
        ? entrySetupDirty.value
        : section.value === 'reminders' && remindersDirty.value);

watch(isDirty, value => emit('dirtyChange', value), { immediate: true });

const promptListOptions = computed(() => promptDraft.value.sourceType === 'custom'
    ? props.model?.promptListOptions.custom ?? []
    : props.model?.promptListOptions.builtIn ?? []);

const templateAvailabilityText = computed(() => {
    if (!props.model || props.model.templateEngine === 'none') return 'Journalyst will use its default entry format.';
    if (props.model.templateAvailability === 'not-installed') return 'The selected template plugin is not installed.';
    if (props.model.templateAvailability === 'disabled') return 'The selected template plugin is disabled.';
    if (props.model.templateAvailability === 'no-template-folder') return 'Configure a template folder before assigning a template.';
    if (props.model.templateStatus === 'missing') return 'The assigned template file is missing.';
    if (props.model.templateStatus === 'outside-folder') return 'The assigned template is outside the configured template folder.';
    return null;
});

async function changeSection(nextSection: JournalSettingsSection) {
    if (nextSection === section.value) return;
    if (!await discardIfNeeded()) return;
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
    if (!await discardIfNeeded()) {
        return false;
    }
    clearFeedback();
    await props.actions.activateJournalSettings(journalPath, section.value);
    return true;
}

async function discardIfNeeded() {
    if (!isDirty.value) return true;
    const discard = await props.actions.confirmDiscardJournalChanges();
    if (discard) hydrate(props.model);
    return discard;
}

async function saveSchedule() {
    if (!props.model || !scheduleDirty.value || scheduleInvalid.value || busy.value) return;
    await runSave(
        () => props.actions.saveJournalCadence(props.model!.journalPath, clone(scheduleDraft.value)),
        'Schedule saved. Changes apply from today.',
    );
}

async function editSchedulePause(pause: JournalSchedulePause | null) {
    if (!props.model || busy.value) return;
    clearFeedback();
    const result = await props.actions.editJournalSchedulePause(props.model.journalPath, pause);
    if (!result) return;
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
    if (!result.ok) {
        error.value = result.error;
        return;
    }
    schedulePauses.value = clone(result.pauses);
    success.value = 'Schedule pause removed.';
}

async function saveEntrySetup() {
    if (!props.model || !entrySetupDirty.value || busy.value) return;
    await runSave(
        () => props.actions.saveJournalEntrySetup(props.model!.journalPath, {
            templatePath: templatePathDraft.value,
            promptSettings: clone(promptDraft.value),
        }),
        'Entry setup saved.',
    );
}

async function saveReminders() {
    if (!props.model || !reminderDraft.value || !remindersDirty.value || busy.value) return;
    await runSave(
        () => props.actions.saveJournalReminderSettings(props.model!.journalPath, clone(reminderDraft.value!)),
        'Reminder rules saved.',
    );
}

async function runSave(
    save: () => ReturnType<MainViewActions['saveJournalCadence']>,
    message: string,
) {
    busy.value = true;
    clearFeedback();
    try {
        const result = await save();
        if (!result.ok) {
            error.value = result.error;
            return;
        }
        success.value = message;
        emit('dirtyChange', false);
        emit('refresh');
    } catch (saveError) {
        error.value = saveError instanceof Error ? saveError.message : 'Journalyst could not save these settings.';
    } finally {
        busy.value = false;
    }
}

async function renameJournal() {
    if (!props.model || busy.value) return;
    if (!await discardIfNeeded()) return;
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

async function generateBases() {
    if (!props.model || busy.value || !props.model.basesEnabled) return;
    busy.value = true;
    clearFeedback();
    try {
        const result = await props.actions.generateBasesForJournal(props.model.journalPath);
        if (!result.ok) error.value = result.error;
        else success.value = 'Journal Bases generated.';
    } finally {
        busy.value = false;
    }
}

async function openGlobalReminders() {
    if (!props.model || !await discardIfNeeded()) return;
    await props.actions.activateJournalTab(props.model.journalPath, 'reminders');
}

function updatePrompt(patch: Partial<JournalPromptSettings>) {
    promptDraft.value = { ...promptDraft.value, ...patch };
    clearFeedback();
}

async function updatePromptSource(sourceType: JournalPromptSettings['sourceType']) {
    const listOptions = sourceType === 'custom'
        ? props.model?.promptListOptions.custom ?? []
        : props.model?.promptListOptions.builtIn ?? [];
    promptDraft.value = {
        ...promptDraft.value,
        sourceType,
        selectedListId: sourceType === 'file' ? undefined : listOptions[0]?.value,
        selectedFilePath: sourceType === 'file' ? props.model?.promptFileOptions[0]?.value : undefined,
        staticPromptId: undefined,
        weekdayOverrides: {},
    };
    clearFeedback();
    await refreshPromptOptions();
}

async function updatePromptSelection(value: string, kind: 'list' | 'file') {
    promptDraft.value = {
        ...promptDraft.value,
        selectedListId: kind === 'list' ? value : undefined,
        selectedFilePath: kind === 'file' ? value : undefined,
        staticPromptId: undefined,
        weekdayOverrides: {},
    };
    clearFeedback();
    await refreshPromptOptions();
}

async function refreshPromptOptions() {
    const requestRevision = ++promptRequestRevision;
    promptOptionsLoading.value = true;
    try {
        const options = await props.actions.loadJournalPromptOptions(clone(promptDraft.value));
        if (requestRevision !== promptRequestRevision) return;
        promptOptions.value = options;
        if (promptDraft.value.selectionMode === 'static' && !options.some(option => option.id === promptDraft.value.staticPromptId)) {
            promptDraft.value = { ...promptDraft.value, staticPromptId: options[0]?.id };
        }
    } finally {
        if (requestRevision === promptRequestRevision) promptOptionsLoading.value = false;
    }
}

function updateWeekdayPrompt(day: number, promptId: string) {
    const weekdayOverrides = { ...promptDraft.value.weekdayOverrides };
    if (promptId) weekdayOverrides[String(day)] = promptId;
    else delete weekdayOverrides[String(day)];
    promptDraft.value = { ...promptDraft.value, weekdayOverrides };
    clearFeedback();
}

function clearFeedback() {
    error.value = '';
    success.value = '';
}
</script>

<template>
    <div class="journalyst-journal-settings-page">
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
                    :busy="busy"
                    :dirty="scheduleDirty"
                    :invalid="scheduleInvalid"
                    @update:cadence="clearFeedback"
                    @save="saveSchedule"
                    @edit-pause="editSchedulePause"
                    @remove-pause="removeSchedulePause"
                />

                <div v-else-if="section === 'entry-setup'" class="journalyst-journal-form-section">
                    <div class="journalyst-journal-section-heading">
                        <div>
                            <h3>Entry setup</h3>
                            <p>Choose the template and optional prompt behavior used for new entries.</p>
                        </div>
                        <button type="button" class="mod-cta" :disabled="busy || !entrySetupDirty" @click="saveEntrySetup">Save entry setup</button>
                    </div>

                    <div class="journalyst-journal-form-group">
                        <h4>Template</h4>
                        <p class="journalyst-journal-help">Global template engine: {{ model.templateEngine === 'none' ? 'None' : model.templateEngine }}</p>
                        <label v-if="model.templateEngine !== 'none' && model.templateAvailability === 'ready'" class="journalyst-journal-field">
                            <span>Journal template</span>
                            <select v-model="templatePathDraft" @change="clearFeedback">
                                <option :value="null">None</option>
                                <option v-for="option in model.templateOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                            </select>
                        </label>
                        <p v-if="templateAvailabilityText" class="journalyst-journal-help is-warning">{{ templateAvailabilityText }}</p>
                    </div>

                    <div class="journalyst-journal-form-group">
                        <div class="journalyst-journal-inline-heading">
                            <div><h4>Prompts</h4><p class="journalyst-journal-help">Add a prompt when Journalyst creates an entry.</p></div>
                            <label class="journalyst-toggle" aria-label="Enable prompts">
                                <input type="checkbox" :checked="promptDraft.enabled" @change="updatePrompt({ enabled: ($event.target as HTMLInputElement).checked })">
                            </label>
                        </div>

                        <template v-if="promptDraft.enabled">
                            <div class="journalyst-journal-field-grid">
                                <label class="journalyst-journal-field">
                                    <span>Source</span>
                                    <select :value="promptDraft.sourceType" @change="updatePromptSource(($event.target as HTMLSelectElement).value as JournalPromptSettings['sourceType'])">
                                        <option value="built-in">Built-in library</option>
                                        <option value="custom">Custom list</option>
                                        <option value="file">Markdown note</option>
                                    </select>
                                </label>
                                <label v-if="promptDraft.sourceType !== 'file'" class="journalyst-journal-field">
                                    <span>Prompt list</span>
                                    <select :value="promptDraft.selectedListId" @change="updatePromptSelection(($event.target as HTMLSelectElement).value, 'list')">
                                        <option v-for="option in promptListOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                                    </select>
                                </label>
                                <label v-else class="journalyst-journal-field">
                                    <span>Prompt note</span>
                                    <select :value="promptDraft.selectedFilePath" @change="updatePromptSelection(($event.target as HTMLSelectElement).value, 'file')">
                                        <option value="">Choose a note</option>
                                        <option v-for="option in model.promptFileOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                                    </select>
                                </label>
                                <label class="journalyst-journal-field">
                                    <span>Selection</span>
                                    <select :value="promptDraft.selectionMode" @change="updatePrompt({ selectionMode: ($event.target as HTMLSelectElement).value as JournalPromptSettings['selectionMode'] })">
                                        <option value="static">Static prompt</option>
                                        <option value="random">Random</option>
                                        <option value="random-no-repeat">Random without repeats</option>
                                    </select>
                                </label>
                                <label class="journalyst-journal-field">
                                    <span>Delivery</span>
                                    <select :value="promptDraft.deliveryMode" @change="updatePrompt({ deliveryMode: ($event.target as HTMLSelectElement).value as JournalPromptSettings['deliveryMode'] })">
                                        <option value="append-body">Append into note</option>
                                        <option value="template-variables">Template variables</option>
                                    </select>
                                </label>
                            </div>

                            <label v-if="promptDraft.selectionMode === 'static'" class="journalyst-journal-field">
                                <span>Static prompt</span>
                                <select :value="promptDraft.staticPromptId" :disabled="promptOptionsLoading" @change="updatePrompt({ staticPromptId: ($event.target as HTMLSelectElement).value })">
                                    <option v-for="option in promptOptions" :key="option.id" :value="option.id">{{ option.title }}</option>
                                </select>
                            </label>

                            <details v-if="promptOptions.length > 0" class="journalyst-prompt-overrides">
                                <summary>Weekday prompt overrides</summary>
                                <div class="journalyst-prompt-override-grid">
                                    <label v-for="(label, day) in weekdayLabels" :key="day" class="journalyst-journal-field">
                                        <span>{{ label }}</span>
                                        <select :value="promptDraft.weekdayOverrides[String(day)] ?? ''" @change="updateWeekdayPrompt(day, ($event.target as HTMLSelectElement).value)">
                                            <option value="">Default selection</option>
                                            <option v-for="option in promptOptions" :key="option.id" :value="option.id">{{ option.title }}</option>
                                        </select>
                                    </label>
                                </div>
                            </details>
                        </template>
                        <p v-if="model.promptStatus" class="journalyst-journal-help is-warning">{{ model.promptStatus }}</p>
                    </div>
                </div>

                <div v-else-if="section === 'reminders' && reminderDraft" class="journalyst-journal-form-section">
                    <div class="journalyst-journal-section-heading">
                        <div>
                            <h3>Reminder rules</h3>
                            <p>Schedule entry nudges and weekly, monthly, or quarterly reviews for this journal.</p>
                        </div>
                        <button type="button" class="mod-cta" :disabled="busy || !remindersDirty" @click="saveReminders">Save reminders</button>
                    </div>
                    <div v-if="!model.remindersEnabled" class="journalyst-journal-notice">
                        <span>Global reminders are currently off. These rules will be saved but will not run.</span>
                        <button type="button" @click="openGlobalReminders">Global controls</button>
                    </div>
                    <div class="journalyst-reminder-rules">
                        <ReminderRuleEditor v-if="model.cadence.type !== 'adhoc'" kind="entry" :settings="reminderDraft" @update="reminderDraft = $event; clearFeedback()" />
                        <div v-else class="journalyst-journal-notice">Ad-hoc journals do not have scheduled entry reminders.</div>
                        <ReminderRuleEditor v-for="period in (['weekly', 'monthly', 'quarterly'] as const)" :key="period" :kind="period" :settings="reminderDraft" @update="reminderDraft = $event; clearFeedback()" />
                    </div>
                </div>

                <div v-else class="journalyst-journal-form-section">
                    <div class="journalyst-journal-section-heading">
                        <div>
                            <h3>Integrations</h3>
                            <p>Generate Journalyst-managed Bases for this journal.</p>
                        </div>
                    </div>
                    <div class="journalyst-integration-row">
                        <div>
                            <h4>Obsidian Bases</h4>
                            <p>{{ model.basesEnabled ? 'Generate or refresh the entries and reflections Bases in this journal.' : 'Enable Bases integration in plugin settings before generating files.' }}</p>
                        </div>
                        <button v-if="model.basesEnabled" type="button" :disabled="busy" @click="generateBases">Generate Bases</button>
                        <button v-else type="button" @click="actions.openSettings">Open settings</button>
                    </div>
                </div>
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

.journalyst-journal-section-heading,
.journalyst-journal-inline-heading,
.journalyst-integration-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-4);
}

.journalyst-journal-section-heading h3,
.journalyst-journal-form-group h4,
.journalyst-integration-row h4 {
    margin: 0;
}

.journalyst-journal-section-heading p,
.journalyst-integration-row p,
.journalyst-journal-help {
    margin: var(--size-4-1) 0 0;
    color: var(--text-muted);
}

.journalyst-journal-form-section {
    padding: var(--size-4-5) 0;
}

.journalyst-journal-form-group {
    padding: var(--size-4-4) 0;
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-journal-field {
    display: flex;
    flex-direction: column;
    gap: var(--size-4-2);
    margin-top: var(--size-4-4);
    max-width: 32rem;
}

.journalyst-journal-field > span {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
}

.journalyst-journal-field-grid,
.journalyst-prompt-override-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 var(--size-4-4);
    max-width: 48rem;
}

.journalyst-prompt-overrides {
    margin-top: var(--size-4-5);
    max-width: 48rem;
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

.journalyst-journal-help.is-warning {
    color: var(--text-warning);
}

.journalyst-journal-notice,
.journalyst-integration-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-3);
}

.journalyst-integration-row {
    padding: var(--size-4-4) 0;
    border-bottom: var(--border-width) solid var(--background-modifier-border);
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
    .journalyst-journal-inline-heading,
    .journalyst-integration-row,
    .journalyst-journal-notice {
        align-items: flex-start;
        flex-direction: column;
    }

    .journalyst-journal-field-grid,
    .journalyst-prompt-override-grid {
        grid-template-columns: minmax(0, 1fr);
    }

    .journalyst-journal-section-heading button {
        width: 100%;
    }
}
</style>
