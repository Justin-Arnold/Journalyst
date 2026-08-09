<script setup lang="ts">
import { computed, ref } from "vue";
import {
    DEFAULT_STARTER_JOURNALS,
    type CompleteOnboardingRequest,
    type OnboardingViewModel,
} from "../../../onboarding";
import ObsidianIcon from "../ObsidianIcon.vue";

const props = defineProps<{
    model: OnboardingViewModel;
    busy: boolean;
    error: string;
}>();

const emit = defineEmits<{
    complete: [request: CompleteOnboardingRequest];
    defer: [];
}>();

const configuredOption = props.model.configuredRootPath
    ? props.model.folderOptions.find(option => option.path === props.model.configuredRootPath)
    : null;
const step = ref<1 | 2>(1);
const rootMode = ref<'new' | 'existing'>(configuredOption ? 'existing' : 'new');
const newRootPath = ref(props.model.suggestedRootPath);
const existingRootPath = ref(configuredOption?.path ?? props.model.folderOptions[0]?.path ?? '/');
const selectedStarters = ref<string[]>([...DEFAULT_STARTER_JOURNALS]);
const customJournalDraft = ref('');
const customJournals = ref<string[]>([]);
const localError = ref('');

const selectedRootPath = computed(() => rootMode.value === 'new'
    ? newRootPath.value.trim()
    : existingRootPath.value);

const selectedRootOption = computed(() => props.model.folderOptions.find(option =>
    option.path.toLocaleLowerCase() === selectedRootPath.value.toLocaleLowerCase()
));

const selectedJournalNames = computed(() => [
    ...selectedStarters.value,
    ...customJournals.value,
]);

const canComplete = computed(() => selectedJournalNames.value.length > 0
    || (selectedRootOption.value?.journalCount ?? 0) > 0);

function selectRootMode(mode: 'new' | 'existing') {
    rootMode.value = mode;
    localError.value = '';
}

function continueToJournals() {
    if (!selectedRootPath.value) {
        localError.value = 'Choose an existing folder or enter a folder path.';
        return;
    }

    localError.value = '';
    step.value = 2;
}

function toggleStarter(name: string, checked: boolean) {
    selectedStarters.value = checked
        ? [...selectedStarters.value, name]
        : selectedStarters.value.filter(candidate => candidate !== name);
}

function addCustomJournal() {
    const name = customJournalDraft.value.trim();
    if (!name) {
        return;
    }

    if (/[\\/]/.test(name)) {
        localError.value = 'Journal names cannot contain path separators.';
        return;
    }

    const starterName = DEFAULT_STARTER_JOURNALS.find(candidate =>
        candidate.toLocaleLowerCase() === name.toLocaleLowerCase()
    );
    if (starterName) {
        if (!selectedStarters.value.includes(starterName)) {
            selectedStarters.value = [...selectedStarters.value, starterName];
        }
        customJournalDraft.value = '';
        localError.value = '';
        return;
    }

    if (customJournals.value.some(candidate => candidate.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        localError.value = 'That journal is already in the list.';
        return;
    }

    customJournals.value = [...customJournals.value, name];
    customJournalDraft.value = '';
    localError.value = '';
}

function removeCustomJournal(name: string) {
    customJournals.value = customJournals.value.filter(candidate => candidate !== name);
}

function completeSetup() {
    if (!canComplete.value) {
        localError.value = 'Select at least one journal, or use a folder that already contains journals.';
        return;
    }

    localError.value = '';
    emit('complete', {
        rootPath: selectedRootPath.value,
        journalNames: selectedJournalNames.value,
    });
}
</script>

<template>
    <div class="journalyst-onboarding">
        <header class="journalyst-onboarding-header">
            <h1>Journalyst</h1>
            <p>Set up a home folder and the journals you want to start with.</p>
        </header>

        <main class="journalyst-onboarding-panel" aria-labelledby="journalyst-onboarding-title">

            <section v-if="step === 1" class="journalyst-onboarding-step">
                <div class="journalyst-onboarding-step-heading">
                    <span class="journalyst-onboarding-step-label">Step 1 of 2</span>
                    <h2 id="journalyst-onboarding-title">Choose a home folder</h2>
                    <p>Journalyst treats each folder inside this location as a separate journal.</p>
                </div>

                <div class="journalyst-onboarding-mode" role="group" aria-label="Folder setup method">
                    <button
                        type="button"
                        :class="{ 'is-active': rootMode === 'new' }"
                        :aria-pressed="rootMode === 'new'"
                        @click="selectRootMode('new')"
                    >
                        Create folder
                    </button>
                    <button
                        type="button"
                        :class="{ 'is-active': rootMode === 'existing' }"
                        :aria-pressed="rootMode === 'existing'"
                        @click="selectRootMode('existing')"
                    >
                        Use existing
                    </button>
                </div>

                <label v-if="rootMode === 'new'" class="journalyst-onboarding-field">
                    <span>Vault-relative folder path</span>
                    <input
                        v-model="newRootPath"
                        type="text"
                        placeholder="Journals"
                        autocomplete="off"
                        @keydown.enter.prevent="continueToJournals"
                    >
                    <small>Nested paths such as <code>Areas/Journals</code> are supported.</small>
                </label>

                <label v-else class="journalyst-onboarding-field">
                    <span>Existing folder</span>
                    <select v-model="existingRootPath">
                        <option v-for="option in model.folderOptions" :key="option.path" :value="option.path">
                            {{ option.name }}{{ option.journalCount ? ` - ${option.journalCount} journal${option.journalCount === 1 ? '' : 's'}` : '' }}
                        </option>
                    </select>
                </label>

                <p v-if="localError || error" class="journalyst-onboarding-error" role="alert">
                    {{ localError || error }}
                </p>

                <div class="journalyst-onboarding-actions">
                    <button type="button" :disabled="busy" @click="emit('defer')">Set up later</button>
                    <button type="button" class="mod-cta" :disabled="busy" @click="continueToJournals">
                        Continue
                        <ObsidianIcon name="arrow-right" />
                    </button>
                </div>
            </section>

            <section v-else class="journalyst-onboarding-step">
                <div class="journalyst-onboarding-step-heading">
                    <span class="journalyst-onboarding-step-label">Step 2 of 2</span>
                    <h2 id="journalyst-onboarding-title">Choose your journals</h2>
                    <p>Select any starting folders you want. You can add or remove journals later.</p>
                </div>

                <div class="journalyst-onboarding-root-summary">
                    <ObsidianIcon name="folder" />
                    <span>{{ selectedRootPath }}</span>
                    <button type="button" :disabled="busy" @click="step = 1">Change</button>
                </div>

                <fieldset class="journalyst-onboarding-starters">
                    <legend>Suggested journals</legend>
                    <label v-for="name in DEFAULT_STARTER_JOURNALS" :key="name">
                        <input
                            type="checkbox"
                            :checked="selectedStarters.includes(name)"
                            @change="toggleStarter(name, ($event.target as HTMLInputElement).checked)"
                        >
                        <span>{{ name }}</span>
                    </label>
                </fieldset>

                <div class="journalyst-onboarding-custom">
                    <label for="journalyst-custom-journal">Custom journal</label>
                    <div class="journalyst-onboarding-custom-input">
                        <input
                            id="journalyst-custom-journal"
                            v-model="customJournalDraft"
                            type="text"
                            placeholder="Journal name"
                            autocomplete="off"
                            @keydown.enter.prevent="addCustomJournal"
                        >
                        <button type="button" aria-label="Add custom journal" title="Add custom journal" @click="addCustomJournal">
                            <ObsidianIcon name="plus" />
                        </button>
                    </div>
                    <div v-if="customJournals.length" class="journalyst-onboarding-custom-list">
                        <span v-for="name in customJournals" :key="name">
                            {{ name }}
                            <button
                                type="button"
                                :aria-label="`Remove ${name}`"
                                :title="`Remove ${name}`"
                                @click="removeCustomJournal(name)"
                            >
                                <ObsidianIcon name="x" />
                            </button>
                        </span>
                    </div>
                </div>

                <p
                    v-if="selectedRootOption?.journalCount && selectedJournalNames.length === 0"
                    class="journalyst-onboarding-existing-note"
                >
                    This folder already contains {{ selectedRootOption.journalCount }} journal folder{{ selectedRootOption.journalCount === 1 ? '' : 's' }}. You can continue without creating more.
                </p>

                <p v-if="localError || error" class="journalyst-onboarding-error" role="alert">
                    {{ localError || error }}
                </p>

                <div class="journalyst-onboarding-actions">
                    <button type="button" :disabled="busy" @click="step = 1">
                        <ObsidianIcon name="arrow-left" />
                        Back
                    </button>
                    <div class="journalyst-onboarding-actions-primary">
                        <button type="button" :disabled="busy" @click="emit('defer')">Set up later</button>
                        <button type="button" class="mod-cta" :disabled="busy || !canComplete" @click="completeSetup">
                            <ObsidianIcon v-if="!busy" name="check" />
                            {{ busy ? 'Creating folders...' : 'Create workspace' }}
                        </button>
                    </div>
                </div>
            </section>
        </main>
    </div>
</template>
