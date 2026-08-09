<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { Menu } from "obsidian";
import type { ReviewWorkspaceTab } from "../../review/types";
import MainViewNavigationTabs from "./MainViewNavigationTabs.vue";
import ObsidianIcon from "./ObsidianIcon.vue";

const props = defineProps<{
    journals: Array<{ path: string; name: string }>;
    tabs: Array<{ id: ReviewWorkspaceTab; label: string; icon: string }>;
}>();

const activeTab = defineModel<ReviewWorkspaceTab>('activeTab', { required: true });
const journalPath = defineModel<string>('journalPath', { required: true });
const anchorDate = defineModel<string>('anchorDate', { required: true });

const emit = defineEmits<{
    createEntry: [];
    createJournal: [];
    openSettings: [];
}>();

let newMenu: Menu | null = null;
const newMenuOpen = ref(false);

function openNewMenu(event: MouseEvent) {
    newMenu?.hide();

    const trigger = event.currentTarget as HTMLButtonElement;
    const triggerBounds = trigger.getBoundingClientRect();
    const menu = new Menu()
        .addItem(item => item
            .setTitle('New entry')
            .setIcon('file-plus')
            .setDisabled(props.journals.length === 0)
            .onClick(() => emit('createEntry')))
        .addItem(item => item
            .setTitle('New journal')
            .setIcon('folder-plus')
            .onClick(() => emit('createJournal')));

    newMenu = menu;
    newMenuOpen.value = true;
    menu.onHide(() => {
        if (newMenu === menu) {
            newMenu = null;
            newMenuOpen.value = false;
        }
    });
    menu.showAtPosition({
        x: triggerBounds.left,
        y: triggerBounds.bottom,
        width: triggerBounds.width,
    }, trigger.ownerDocument);
}

onBeforeUnmount(() => newMenu?.hide());
</script>

<template>
    <header class="journalyst-review-header">
        <MainViewNavigationTabs
            v-model:active-tab="activeTab"
            class="journalyst-header-tabs"
            :tabs="tabs"
        />

        <div v-if="activeTab !== 'home'" class="journalyst-review-controls">
            <label class="journalyst-review-control">
                <span>Journal</span>
                <select v-model="journalPath">
                    <option v-for="journal in journals" :key="journal.path" :value="journal.path">
                        {{ journal.name }}
                    </option>
                </select>
            </label>
            <label class="journalyst-review-control">
                <span>Anchor date</span>
                <input v-model="anchorDate" type="date">
            </label>
        </div>
        <div v-if="activeTab === 'home'" class="journalyst-review-header-actions">
            <button
                type="button"
                class="journalyst-new-button"
                aria-haspopup="menu"
                :aria-expanded="newMenuOpen"
                @click="openNewMenu"
            >
                <ObsidianIcon name="plus" />
                <span>New</span>
                <ObsidianIcon name="chevron-down" />
            </button>
            <button
                type="button"
                class="clickable-icon journalyst-settings-button"
                aria-label="Open Journalyst settings"
                title="Open Journalyst settings"
                @click="emit('openSettings')"
            >
                <ObsidianIcon name="settings" />
            </button>
        </div>
    </header>
</template>

<style scoped>
.journalyst-review-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
}

.journalyst-header-tabs {
    flex: 0 1 auto;
    min-width: 0;
}

.journalyst-review-controls {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-left: auto;
}

.journalyst-review-control {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 220px;
    flex: 1 1 220px;
}

.journalyst-review-control span {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.journalyst-review-control select,
.journalyst-review-control input {
    width: 100%;
}

.journalyst-review-header-actions {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-left: auto;
}

.journalyst-review-header-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--input-height);
}

.journalyst-new-button {
    gap: var(--size-4-1);
    padding: 0 var(--size-4-3);
}

.journalyst-settings-button {
    width: var(--input-height);
    height: var(--input-height);
    padding: 0;
}

.journalyst-review-header-actions button:focus-visible {
    outline: var(--border-width) solid var(--color-accent);
    outline-offset: var(--size-2-1);
}

@media (max-width: 700px) {
    .journalyst-review-controls {
        width: 100%;
        margin-left: 0;
    }

    .journalyst-review-control {
        min-width: 0;
        flex: 1 1 100%;
    }
}

@media (max-width: 430px) {
    .journalyst-review-header-actions {
        width: 100%;
        justify-content: flex-start;
        margin-left: 0;
    }
}
</style>
