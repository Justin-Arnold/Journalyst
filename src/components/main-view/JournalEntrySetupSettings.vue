<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type {
    JournalPromptPreviewModel,
    JournalPromptSourceOption,
    JournalSettingsViewModel,
} from '../../../journalSettings';
import type {
    JournalPromptSettings,
    PromptDeliveryMode,
    PromptOption,
    PromptSelectionMode,
    PromptSourceSelection,
    PromptSourceType,
} from '../../../prompts';
import ObsidianIcon from '../ObsidianIcon.vue';
import type { MainViewActions } from './types';

const props = defineProps<{
    model: JournalSettingsViewModel;
    actions: MainViewActions;
    busy: boolean;
    dirty: boolean;
}>();

const templatePath = defineModel<string | null>('templatePath', { required: true });
const promptSettings = defineModel<JournalPromptSettings>('promptSettings', { required: true });

const emit = defineEmits<{
    change: [];
    save: [];
}>();

const weekdayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const promptOptions = ref<PromptOption[]>(props.model.promptOptions);
const preview = ref<JournalPromptPreviewModel | null>(null);
const promptLoading = ref(false);
const promptError = ref('');
const copiedVariable = ref<PromptVariableKey | null>(null);
const copyStatus = ref('');
let promptRequestRevision = 0;
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

type PromptVariableKey = 'prompt' | 'prompt-title';

interface PromptTemplateVariable {
    key: PromptVariableKey;
    label: string;
    value: string;
}

const sourceMode = computed<'off' | 'library' | 'note'>(() => {
    if (!promptSettings.value.enabled) return 'off';
    return promptSettings.value.sourceType === 'file' ? 'note' : 'library';
});

const libraryOptions = computed(() => props.model.promptSourceOptions
    .filter(option => option.source.sourceType !== 'file'));
const noteOptions = computed(() => props.model.promptSourceOptions
    .filter(option => option.source.sourceType === 'file'));
const sourceGroups = computed(() => {
    const groups = new Map<JournalPromptSourceOption['group'], JournalPromptSourceOption[]>();
    props.model.promptSourceOptions.forEach(option => {
        const options = groups.get(option.group) ?? [];
        options.push(option);
        groups.set(option.group, options);
    });
    return [...groups.entries()];
});

const selectedLibraryValue = computed(() => sourceValue({
    sourceType: promptSettings.value.sourceType,
    selectedListId: promptSettings.value.selectedListId,
}));
const selectedNoteValue = computed(() => sourceValue({
    sourceType: 'file',
    selectedFilePath: promptSettings.value.selectedFilePath,
}));
const templateEngineLabel = computed(() => props.model.templateEngine === 'none'
    ? 'None'
    : props.model.templateEngine === 'core'
        ? 'Obsidian Templates'
        : 'Templater');
const templateFailureLabel = computed(() => props.model.templateFailureBehavior === 'abort'
    ? 'Stop entry creation'
    : 'Create Journalyst default');
const selectedTemplateStatus = computed(() => templatePath.value === props.model.templatePath
    ? props.model.templateStatus
    : templatePath.value
        ? 'valid'
        : 'none');
const canUseTemplateVariables = computed(() => props.model.templateEngine !== 'none'
    && props.model.templateAvailability === 'ready'
    && selectedTemplateStatus.value === 'valid'
    && !!templatePath.value);
const templateAvailabilityText = computed(() => {
    if (props.model.templateEngine === 'none') return 'Choose a template engine in plugin settings to assign journal templates.';
    if (props.model.templateAvailability === 'not-installed') return 'The selected template plugin is not installed.';
    if (props.model.templateAvailability === 'disabled') return 'The selected template plugin is disabled.';
    if (props.model.templateAvailability === 'no-template-folder') return 'Configure a template folder before assigning a template.';
    if (selectedTemplateStatus.value === 'missing') return 'The assigned template file is missing.';
    if (selectedTemplateStatus.value === 'outside-folder') return 'The assigned template is outside the configured template folder.';
    return null;
});
const promptStatusText = computed(() => {
    if (!promptSettings.value.enabled || promptLoading.value) return null;
    if (promptError.value) return promptError.value;
    if (promptOptions.value.length === 0) return 'No prompts are available from this source.';
    if (promptSettings.value.deliveryMode === 'template-variables' && !canUseTemplateVariables.value) {
        return 'Template variables need a valid journal template. Journalyst will use body delivery until one is available.';
    }
    return null;
});
const promptInfoText = computed(() => {
    if (!promptSettings.value.enabled
        || promptSettings.value.deliveryMode !== 'template-variables'
        || !canUseTemplateVariables.value) {
        return null;
    }
    return props.model.templateEngine === 'templater'
        ? 'Copy these expressions into your selected Templater template.'
        : 'Copy these placeholders into your selected template.';
});
const promptTemplateVariables = computed<PromptTemplateVariable[]>(() => props.model.templateEngine === 'templater'
    ? [
        { key: 'prompt', label: 'Prompt', value: '<% tp.frontmatter.journalyst_prompt %>' },
        { key: 'prompt-title', label: 'Prompt title', value: '<% tp.frontmatter.journalyst_prompt_title %>' },
    ]
    : [
        { key: 'prompt', label: 'Prompt', value: '{{prompt}}' },
        { key: 'prompt-title', label: 'Prompt title', value: '{{promptTitle}}' },
    ]);

onBeforeUnmount(() => {
    if (copyFeedbackTimer !== null) clearTimeout(copyFeedbackTimer);
});

watch(
    () => props.model.journalPath,
    () => {
        promptOptions.value = props.model.promptOptions;
        void refreshPromptData();
    },
    { immediate: true },
);

watch(
    promptSettings,
    () => {
        emit('change');
        void refreshPromptData();
    },
    { deep: true },
);

async function refreshPromptData() {
    const requestRevision = ++promptRequestRevision;
    promptError.value = '';
    if (!promptSettings.value.enabled) {
        promptOptions.value = [];
        preview.value = null;
        promptLoading.value = false;
        return;
    }

    promptLoading.value = true;
    try {
        const settings = clone(promptSettings.value);
        const [options, nextPreview] = await Promise.all([
            props.actions.loadJournalPromptOptions(settings),
            props.actions.loadJournalPromptPreview(settings),
        ]);
        if (requestRevision !== promptRequestRevision) return;
        promptOptions.value = options;
        preview.value = nextPreview;
    } catch (error) {
        if (requestRevision !== promptRequestRevision) return;
        promptOptions.value = [];
        preview.value = null;
        promptError.value = error instanceof Error ? error.message : 'Journalyst could not load this prompt source.';
    } finally {
        if (requestRevision === promptRequestRevision) promptLoading.value = false;
    }
}

function setSourceMode(mode: 'off' | 'library' | 'note') {
    if (mode === 'off') {
        updatePrompt({ enabled: false });
        return;
    }

    const options = mode === 'note' ? noteOptions.value : libraryOptions.value;
    const currentMatchesMode = mode === 'note'
        ? promptSettings.value.sourceType === 'file'
        : promptSettings.value.sourceType !== 'file';
    const current = currentSource();
    const source = currentMatchesMode
        ? options.find(option => sourceValue(option.source) === sourceValue(current))?.source
            ?? options[0]?.source
        : options[0]?.source;
    if (!source) {
        updatePrompt({
            enabled: true,
            sourceType: mode === 'note' ? 'file' : 'built-in',
            selectedFilePath: undefined,
            selectedListId: undefined,
            staticPromptId: undefined,
        });
        return;
    }

    setDefaultSource(source);
}

function setDefaultSource(source: PromptSourceSelection) {
    promptSettings.value = {
        ...promptSettings.value,
        enabled: true,
        sourceType: source.sourceType,
        selectedListId: source.sourceType === 'file' ? undefined : source.selectedListId,
        selectedFilePath: source.sourceType === 'file' ? source.selectedFilePath : undefined,
        staticPromptId: undefined,
    };
}

function setDefaultSourceFromValue(value: string) {
    const source = sourceFromValue(value);
    if (source) setDefaultSource(source);
}

function setSelectionMode(selectionMode: PromptSelectionMode) {
    updatePrompt({
        selectionMode,
        staticPromptId: selectionMode === 'static'
            ? promptOptions.value.find(option => option.id === promptSettings.value.staticPromptId)?.id
                ?? promptOptions.value[0]?.id
            : promptSettings.value.staticPromptId,
    });
}

function setDeliveryMode(deliveryMode: PromptDeliveryMode) {
    updatePrompt({ deliveryMode });
}

async function copyPromptVariable(variable: PromptTemplateVariable) {
    if (copyFeedbackTimer !== null) clearTimeout(copyFeedbackTimer);
    copiedVariable.value = null;
    copyStatus.value = '';

    try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(variable.value);
        copiedVariable.value = variable.key;
        copyStatus.value = `${variable.label} variable copied.`;
    } catch {
        copyStatus.value = `Could not copy the ${variable.label.toLowerCase()} variable.`;
    }

    copyFeedbackTimer = setTimeout(() => {
        copiedVariable.value = null;
        copyStatus.value = '';
        copyFeedbackTimer = null;
    }, 1600);
}

function updatePrompt(patch: Partial<JournalPromptSettings>) {
    promptSettings.value = { ...promptSettings.value, ...patch };
}

function getWeekdayValue(day: number) {
    const source = promptSettings.value.weekdaySourceOverrides[String(day)];
    if (source) return sourceValue(source);
    if (promptSettings.value.weekdayOverrides[String(day)]) return `legacy:${day}`;
    return '';
}

function setWeekdaySource(day: number, value: string) {
    if (value.startsWith('legacy:')) return;
    const weekdaySourceOverrides = clone(promptSettings.value.weekdaySourceOverrides);
    const weekdayOverrides = { ...promptSettings.value.weekdayOverrides };
    const dayKey = String(day);
    const source = sourceFromValue(value);

    if (source) weekdaySourceOverrides[dayKey] = source;
    else delete weekdaySourceOverrides[dayKey];
    delete weekdayOverrides[dayKey];

    updatePrompt({ weekdaySourceOverrides, weekdayOverrides });
}

function currentSource(): PromptSourceSelection {
    return promptSettings.value.sourceType === 'file'
        ? { sourceType: 'file', selectedFilePath: promptSettings.value.selectedFilePath }
        : {
            sourceType: promptSettings.value.sourceType,
            selectedListId: promptSettings.value.selectedListId,
        };
}

function sourceValue(source: PromptSourceSelection) {
    const identifier = source.sourceType === 'file'
        ? source.selectedFilePath ?? ''
        : source.selectedListId ?? '';
    return `${source.sourceType}:${identifier}`;
}

function sourceFromValue(value: string): PromptSourceSelection | null {
    const separatorIndex = value.indexOf(':');
    if (separatorIndex < 0) return null;
    const sourceType = value.slice(0, separatorIndex) as PromptSourceType;
    const identifier = value.slice(separatorIndex + 1);
    if (!identifier || !['built-in', 'custom', 'file'].includes(sourceType)) return null;
    return sourceType === 'file'
        ? { sourceType, selectedFilePath: identifier }
        : { sourceType, selectedListId: identifier };
}

function optionLabel(option: JournalPromptSourceOption) {
    return option.promptCount === undefined
        ? option.label
        : `${option.label} (${option.promptCount})`;
}

function hasSourceOption(value: string) {
    return props.model.promptSourceOptions.some(option => sourceValue(option.source) === value);
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
</script>

<template>
    <div class="journalyst-entry-setup-settings">
        <section class="journalyst-entry-setup-block">
            <header class="journalyst-entry-setup-header">
                <span class="journalyst-entry-setup-title">
                    <ObsidianIcon name="file-cog" />
                    <span>Template</span>
                </span>
                <button type="button" class="journalyst-entry-setup-context" @click="actions.openSettings">
                    Engine: {{ templateEngineLabel }}
                    <ObsidianIcon name="external-link" />
                </button>
            </header>

            <div class="journalyst-entry-setup-row">
                <div>
                    <h3>Template file</h3>
                    <p>Applied when Journalyst creates a new entry for this journal.</p>
                </div>
                <div class="journalyst-entry-setup-control is-template">
                    <select
                        v-model="templatePath"
                        :disabled="model.templateEngine === 'none' || model.templateAvailability !== 'ready'"
                        aria-label="Journal template"
                        @change="emit('change')"
                    >
                        <option :value="null">Journalyst default</option>
                        <option
                            v-if="templatePath && !model.templateOptions.some(option => option.value === templatePath)"
                            :value="templatePath"
                        >
                            {{ templatePath }}
                        </option>
                        <option v-for="option in model.templateOptions" :key="option.value" :value="option.value">
                            {{ option.label }}
                        </option>
                    </select>
                    <button
                        type="button"
                        class="clickable-icon"
                        :disabled="!templatePath || selectedTemplateStatus === 'missing'"
                        aria-label="Open selected template"
                        title="Open selected template"
                        @click="templatePath && actions.openNote(templatePath)"
                    >
                        <ObsidianIcon name="external-link" />
                    </button>
                </div>
            </div>

            <div class="journalyst-entry-setup-row">
                <div>
                    <h3>When the template cannot run</h3>
                    <p>This journal inherits the plugin-wide template failure policy.</p>
                </div>
                <button type="button" class="journalyst-entry-setup-policy" @click="actions.openSettings">
                    {{ templateFailureLabel }}
                    <ObsidianIcon name="settings-2" />
                </button>
            </div>

            <p v-if="templateAvailabilityText" class="journalyst-entry-setup-warning" role="status">
                <ObsidianIcon name="triangle-alert" />
                <span>{{ templateAvailabilityText }}</span>
            </p>
        </section>

        <section class="journalyst-entry-setup-block">
            <header class="journalyst-entry-setup-header">
                <span class="journalyst-entry-setup-title">
                    <ObsidianIcon name="hash" />
                    <span>Prompts</span>
                </span>
                <button type="button" class="journalyst-entry-setup-context" @click="actions.openSettings">
                    Manage libraries
                    <ObsidianIcon name="external-link" />
                </button>
            </header>

            <div class="journalyst-entry-setup-row">
                <div>
                    <h3>Prompt source</h3>
                    <p>Choose where this journal draws prompts from.</p>
                </div>
                <div class="journalyst-segmented-control" role="group" aria-label="Prompt source">
                    <button type="button" :aria-pressed="sourceMode === 'off'" @click="setSourceMode('off')">Off</button>
                    <button type="button" :aria-pressed="sourceMode === 'library'" @click="setSourceMode('library')">Library</button>
                    <button type="button" :aria-pressed="sourceMode === 'note'" @click="setSourceMode('note')">Note</button>
                </div>
            </div>

            <div v-if="sourceMode === 'library'" class="journalyst-entry-setup-row">
                <div>
                    <h3>Library</h3>
                    <p>Built-in and custom libraries can be shared across journals.</p>
                </div>
                <select :value="selectedLibraryValue" aria-label="Prompt library" @change="setDefaultSourceFromValue(($event.target as HTMLSelectElement).value)">
                    <optgroup label="Built-in libraries">
                        <option v-for="option in libraryOptions.filter(item => item.group === 'Built-in libraries')" :key="sourceValue(option.source)" :value="sourceValue(option.source)">
                            {{ optionLabel(option) }}
                        </option>
                    </optgroup>
                    <optgroup v-if="libraryOptions.some(item => item.group === 'Custom libraries')" label="Custom libraries">
                        <option v-for="option in libraryOptions.filter(item => item.group === 'Custom libraries')" :key="sourceValue(option.source)" :value="sourceValue(option.source)">
                            {{ optionLabel(option) }}
                        </option>
                    </optgroup>
                </select>
            </div>

            <div v-if="sourceMode === 'note'" class="journalyst-entry-setup-row">
                <div>
                    <h3>Prompt note</h3>
                    <p>Journalyst reads Markdown list items from this note.</p>
                </div>
                <select :value="selectedNoteValue" aria-label="Prompt note" @change="setDefaultSourceFromValue(($event.target as HTMLSelectElement).value)">
                    <option value="">Choose a note</option>
                    <option v-if="selectedNoteValue !== 'file:' && !hasSourceOption(selectedNoteValue)" :value="selectedNoteValue">
                        {{ promptSettings.selectedFilePath }} (missing)
                    </option>
                    <option v-for="option in noteOptions" :key="sourceValue(option.source)" :value="sourceValue(option.source)">
                        {{ option.label }}
                    </option>
                </select>
            </div>

            <template v-if="sourceMode !== 'off'">
                <div class="journalyst-entry-setup-row">
                    <div>
                        <h3>Selection</h3>
                        <p>Control how Journalyst chooses the next prompt.</p>
                    </div>
                    <div class="journalyst-segmented-control" role="group" aria-label="Prompt selection">
                        <button type="button" :aria-pressed="promptSettings.selectionMode === 'random-no-repeat'" @click="setSelectionMode('random-no-repeat')">Rotate</button>
                        <button type="button" :aria-pressed="promptSettings.selectionMode === 'random'" @click="setSelectionMode('random')">Random</button>
                        <button type="button" :aria-pressed="promptSettings.selectionMode === 'static'" @click="setSelectionMode('static')">Fixed</button>
                    </div>
                </div>

                <div v-if="promptSettings.selectionMode === 'static'" class="journalyst-entry-setup-row">
                    <div>
                        <h3>Fixed prompt</h3>
                        <p>Use the same prompt for every new entry.</p>
                    </div>
                    <select
                        :value="promptSettings.staticPromptId ?? promptOptions[0]?.id"
                        :disabled="promptLoading || promptOptions.length === 0"
                        aria-label="Fixed prompt"
                        @change="updatePrompt({ staticPromptId: ($event.target as HTMLSelectElement).value })"
                    >
                        <option v-for="option in promptOptions" :key="option.id" :value="option.id">{{ option.title }}</option>
                    </select>
                </div>

                <div class="journalyst-entry-setup-row">
                    <div>
                        <h3>Delivery</h3>
                        <p>Choose how the prompt appears in a generated entry.</p>
                    </div>
                    <div class="journalyst-segmented-control" role="group" aria-label="Prompt delivery">
                        <button type="button" :aria-pressed="promptSettings.deliveryMode === 'append-body'" @click="setDeliveryMode('append-body')">Body</button>
                        <button type="button" :aria-pressed="promptSettings.deliveryMode === 'callout'" @click="setDeliveryMode('callout')">Callout</button>
                        <button
                            type="button"
                            :aria-pressed="promptSettings.deliveryMode === 'template-variables'"
                            :disabled="!canUseTemplateVariables && promptSettings.deliveryMode !== 'template-variables'"
                            @click="setDeliveryMode('template-variables')"
                        >Variables</button>
                    </div>
                </div>
            </template>

            <p v-if="promptStatusText" class="journalyst-entry-setup-warning" role="status">
                <ObsidianIcon name="triangle-alert" />
                <span>{{ promptStatusText }}</span>
            </p>
            <div v-else-if="promptInfoText" class="journalyst-prompt-variable-help">
                <p class="journalyst-entry-setup-info">
                    <ObsidianIcon name="info" />
                    <span>{{ promptInfoText }}</span>
                </p>
                <div class="journalyst-prompt-variable-list" aria-label="Template prompt variables">
                    <div v-for="variable in promptTemplateVariables" :key="variable.key" class="journalyst-prompt-variable-row">
                        <span>{{ variable.label }}</span>
                        <code>{{ variable.value }}</code>
                        <button
                            type="button"
                            class="clickable-icon"
                            :aria-label="copiedVariable === variable.key ? `${variable.label} variable copied` : `Copy ${variable.label.toLowerCase()} variable`"
                            :title="copiedVariable === variable.key ? 'Copied' : `Copy ${variable.label.toLowerCase()} variable`"
                            @click="copyPromptVariable(variable)"
                        >
                            <ObsidianIcon :name="copiedVariable === variable.key ? 'check' : 'copy'" />
                        </button>
                    </div>
                </div>
                <span class="journalyst-prompt-copy-status" aria-live="polite">{{ copyStatus }}</span>
            </div>
        </section>

        <section v-if="sourceMode !== 'off'" class="journalyst-entry-setup-block">
            <header class="journalyst-entry-setup-header">
                <span class="journalyst-entry-setup-title">
                    <ObsidianIcon name="calendar-days" />
                    <span>Weekday overrides</span>
                </span>
                <span v-if="promptSettings.selectionMode === 'static'" class="journalyst-entry-setup-meta">Unavailable with Fixed</span>
                <span v-else class="journalyst-entry-setup-meta">Optional</span>
            </header>

            <div class="journalyst-weekday-source-list">
                <label v-for="(label, day) in weekdayLabels" :key="day" class="journalyst-weekday-source-row">
                    <span>{{ label }}</span>
                    <select :value="getWeekdayValue(day)" @change="setWeekdaySource(day, ($event.target as HTMLSelectElement).value)">
                        <option value="">Default source</option>
                        <option
                            v-if="getWeekdayValue(day) && !getWeekdayValue(day).startsWith('legacy:') && !hasSourceOption(getWeekdayValue(day))"
                            :value="getWeekdayValue(day)"
                        >
                            Missing source
                        </option>
                        <option
                            v-if="promptSettings.weekdayOverrides[String(day)] && model.legacyWeekdayPromptLabels[String(day)]"
                            :value="`legacy:${day}`"
                            disabled
                        >
                            Fixed: {{ model.legacyWeekdayPromptLabels[String(day)] }}
                        </option>
                        <optgroup
                            v-for="([group, options]) in sourceGroups"
                            :key="group"
                            :label="group"
                            :disabled="promptSettings.selectionMode === 'static'"
                        >
                            <option v-for="option in options" :key="sourceValue(option.source)" :value="sourceValue(option.source)">
                                {{ optionLabel(option) }}
                            </option>
                        </optgroup>
                    </select>
                </label>
            </div>
        </section>

        <section class="journalyst-entry-setup-block">
            <header class="journalyst-entry-setup-header">
                <span class="journalyst-entry-setup-title">
                    <ObsidianIcon name="text-cursor-input" />
                    <span>Prompt preview</span>
                </span>
                <span v-if="preview" class="journalyst-entry-setup-meta">{{ preview.sourceLabel }}</span>
            </header>

            <div class="journalyst-prompt-output-preview" aria-live="polite">
                <span v-if="sourceMode === 'off'">Prompts are off for this journal.</span>
                <span v-else-if="promptLoading">Loading prompt preview...</span>
                <span v-else-if="!preview">No prompt is available to preview.</span>
                <pre v-else><code>{{ preview.output }}</code></pre>
            </div>
        </section>

        <footer class="journalyst-entry-setup-save">
            <button type="button" class="mod-cta" :disabled="busy || !dirty" @click="emit('save')">
                Save entry setup
            </button>
        </footer>
    </div>
</template>

<style scoped>
.journalyst-entry-setup-settings,
.journalyst-entry-setup-block {
    display: flex;
    min-width: 0;
    flex-direction: column;
}

.journalyst-entry-setup-settings {
    gap: var(--size-4-6);
}

.journalyst-entry-setup-header,
.journalyst-entry-setup-title,
.journalyst-entry-setup-context,
.journalyst-entry-setup-control,
.journalyst-entry-setup-policy,
.journalyst-entry-setup-warning,
.journalyst-entry-setup-info {
    display: flex;
    align-items: center;
}

.journalyst-entry-setup-header {
    min-height: var(--input-height);
    justify-content: space-between;
    gap: var(--size-4-3);
    padding-bottom: var(--size-4-2);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
}

.journalyst-entry-setup-title {
    gap: var(--size-4-2);
    text-transform: uppercase;
}

.journalyst-entry-setup-context,
.journalyst-entry-setup-policy {
    width: auto;
    gap: var(--size-4-2);
    padding: var(--size-4-1) var(--size-4-2);
    border: 0;
    box-shadow: none;
    background: transparent;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
}

.journalyst-entry-setup-context:hover,
.journalyst-entry-setup-policy:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

.journalyst-entry-setup-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(14rem, 25rem);
    align-items: center;
    gap: var(--size-4-5);
    padding: var(--size-4-4) var(--size-4-1);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-entry-setup-row h3,
.journalyst-entry-setup-row p,
.journalyst-entry-setup-warning,
.journalyst-prompt-output-preview pre {
    margin: 0;
}

.journalyst-entry-setup-row h3 {
    font-size: var(--font-ui-medium);
}

.journalyst-entry-setup-row p {
    margin-top: var(--size-4-1);
    color: var(--text-muted);
}

.journalyst-entry-setup-row > select,
.journalyst-entry-setup-control,
.journalyst-segmented-control,
.journalyst-entry-setup-policy {
    width: 100%;
}

.journalyst-entry-setup-control {
    min-width: 0;
    gap: var(--size-4-2);
}

.journalyst-entry-setup-control select {
    min-width: 0;
    flex: 1 1 auto;
}

.journalyst-segmented-control {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    padding: 2px;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-segmented-control button {
    min-width: 0;
    border: 0;
    box-shadow: none;
    background: transparent;
    color: var(--text-muted);
}

.journalyst-segmented-control button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

.journalyst-segmented-control button[aria-pressed="true"] {
    background: var(--journalyst-accent-dark);
    color: var(--text-on-accent);
}

.journalyst-entry-setup-warning {
    gap: var(--size-4-2);
    padding: var(--size-4-3);
    margin-top: var(--size-4-3);
    border-left: 2px solid var(--text-warning);
    background: var(--background-secondary);
    color: var(--text-warning);
}

.journalyst-entry-setup-info {
    gap: var(--size-4-2);
    color: var(--text-muted);
}

.journalyst-prompt-variable-help {
    padding: var(--size-4-3);
    margin-top: var(--size-4-3);
    border-left: 2px solid var(--interactive-accent);
    background: var(--background-secondary);
}

.journalyst-prompt-variable-help p {
    margin: 0;
}

.journalyst-prompt-variable-list {
    display: grid;
    gap: var(--size-4-2);
    margin-top: var(--size-4-3);
}

.journalyst-prompt-variable-row {
    display: grid;
    min-width: 0;
    grid-template-columns: 6rem minmax(0, 1fr) var(--input-height);
    align-items: center;
    gap: var(--size-4-2);
    padding-top: var(--size-4-2);
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-prompt-variable-row > span {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
}

.journalyst-prompt-variable-row code {
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--text-normal);
}

.journalyst-prompt-variable-row button {
    width: var(--input-height);
    height: var(--input-height);
}

.journalyst-prompt-copy-status {
    display: block;
    min-height: 1.4em;
    margin-top: var(--size-4-2);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
}

.journalyst-entry-setup-meta {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
}

.journalyst-weekday-source-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 var(--size-4-5);
}

.journalyst-weekday-source-row {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    align-items: center;
    gap: var(--size-4-3);
    padding: var(--size-4-3) var(--size-4-1);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-weekday-source-row > span {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
}

.journalyst-prompt-output-preview {
    min-height: 7rem;
    padding: var(--size-4-4);
    border: var(--border-width) solid var(--background-modifier-border);
    border-top: 0;
    background: var(--journalyst-base-recessed);
    color: var(--text-muted);
}

.journalyst-prompt-output-preview pre {
    overflow-x: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--text-normal);
}

.journalyst-prompt-output-preview code {
    padding: 0;
    background: transparent;
    color: inherit;
}

.journalyst-entry-setup-save {
    display: flex;
    justify-content: flex-end;
    padding-top: var(--size-4-2);
}

button:focus-visible,
select:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@media (max-width: 700px) {
    .journalyst-entry-setup-row {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--size-4-3);
    }

    .journalyst-weekday-source-list {
        grid-template-columns: minmax(0, 1fr);
    }
}

@media (max-width: 460px) {
    .journalyst-entry-setup-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .journalyst-entry-setup-context {
        width: auto;
    }

    .journalyst-segmented-control {
        grid-auto-flow: row;
    }

    .journalyst-prompt-variable-row {
        grid-template-columns: minmax(0, 1fr) var(--input-height);
    }

    .journalyst-prompt-variable-row > span {
        grid-column: 1 / -1;
    }

    .journalyst-entry-setup-save button {
        width: 100%;
    }
}
</style>
