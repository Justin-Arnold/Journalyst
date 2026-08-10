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

        <div class="journalyst-review-header-actions">
            <button
                v-if="activeTab === 'home'"
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
    min-height: var(--size-4-16);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.25rem;
    flex-wrap: nowrap;
    border-bottom: var(--border-width) solid var(--background-modifier-border);
    margin-bottom: 1rem;
}

.journalyst-header-tabs {
    flex: 0 1 auto;
    min-width: 0;
}

.journalyst-review-header-actions {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-left: auto;
    flex: 0 0 auto;
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

</style>
