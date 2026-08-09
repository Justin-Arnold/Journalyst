<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { Menu } from "obsidian";
import ObsidianIcon from "../ObsidianIcon.vue";

const props = defineProps<{
    journalName: string;
    todayExists: boolean;
    todayIsComplete: boolean;
    dueToday: boolean;
}>();

const emit = defineEmits<{
    today: [];
    navigate: [tab: 'review' | 'synthesis'];
    editJournal: [];
}>();

let actionsMenu: Menu | null = null;
const menuOpen = ref(false);

const todayAction = computed(() => {
    if (props.todayExists) {
        return props.todayIsComplete
            ? { label: 'Open today', icon: 'file-pen-line', emphasized: false }
            : { label: 'Continue today', icon: 'pencil-line', emphasized: true };
    }

    return props.dueToday
        ? { label: 'Write today', icon: 'file-plus', emphasized: true }
        : { label: 'Go to today', icon: 'calendar-plus', emphasized: false };
});

function openActionsMenu(event: MouseEvent) {
    actionsMenu?.hide();

    const trigger = event.currentTarget as HTMLButtonElement;
    const bounds = trigger.getBoundingClientRect();
    const menu = new Menu()
        .addItem(item => item
            .setTitle('Review')
            .setIcon('history')
            .onClick(() => emit('navigate', 'review')))
        .addItem(item => item
            .setTitle('Synthesis')
            .setIcon('file-pen-line')
            .onClick(() => emit('navigate', 'synthesis')))
        .addSeparator()
        .addItem(item => item
            .setTitle('Edit journal')
            .setIcon('settings-2')
            .onClick(() => emit('editJournal')));

    actionsMenu = menu;
    menuOpen.value = true;
    menu.onHide(() => {
        if (actionsMenu === menu) {
            actionsMenu = null;
            menuOpen.value = false;
        }
    });
    menu.showAtPosition({
        x: bounds.left,
        y: bounds.bottom,
        width: bounds.width,
    }, trigger.ownerDocument);
}

onBeforeUnmount(() => actionsMenu?.hide());
</script>

<template>
    <div class="journalyst-card-actions">
        <button
            type="button"
            class="journalyst-card-today-action"
            :class="{ 'mod-cta': todayAction.emphasized }"
            @click="emit('today')"
        >
            <ObsidianIcon :name="todayAction.icon" />
            <span>{{ todayAction.label }}</span>
        </button>
        <button
            type="button"
            class="clickable-icon journalyst-card-more-action"
            aria-haspopup="menu"
            :aria-expanded="menuOpen"
            :aria-label="`More actions for ${journalName}`"
            :title="`More actions for ${journalName}`"
            @click="openActionsMenu"
        >
            <ObsidianIcon name="ellipsis" />
        </button>
    </div>
</template>

<style scoped>
.journalyst-card-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-2);
    margin-top: auto;
    padding-top: var(--size-4-2);
}

.journalyst-card-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--input-height);
}

.journalyst-card-today-action {
    gap: var(--size-4-2);
    min-width: 8.5rem;
    padding: 0 var(--size-4-3);
}

.journalyst-card-more-action {
    width: var(--input-height);
    height: var(--input-height);
    padding: 0;
}

.journalyst-card-actions button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}
</style>
