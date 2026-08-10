<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { Menu } from 'obsidian';
import moment from 'moment';
import ObsidianIcon from './ObsidianIcon.vue';

const props = defineProps<{
    journals: Array<{ path: string; name: string }>;
}>();

const journalPath = defineModel<string>('journalPath', { required: true });
const anchorDate = defineModel<string>('anchorDate', { required: true });
const anchorInput = ref<HTMLInputElement | null>(null);
const selectedJournalName = computed(() => props.journals.find(
    journal => journal.path === journalPath.value,
)?.name ?? 'Choose journal');
const formattedAnchorDate = computed(() => moment(
    anchorDate.value,
    'YYYY-MM-DD',
    true,
).format('dddd, MMMM D, YYYY'));
let journalMenu: Menu | null = null;

function openJournalMenu(event: MouseEvent) {
    journalMenu?.hide();

    const trigger = event.currentTarget as HTMLButtonElement;
    const bounds = trigger.getBoundingClientRect();
    const menu = new Menu();
    props.journals.forEach(journal => {
        menu.addItem(item => item
            .setTitle(journal.name)
            .setChecked(journal.path === journalPath.value)
            .onClick(() => {
                journalPath.value = journal.path;
            }));
    });

    journalMenu = menu;
    menu.onHide(() => {
        if (journalMenu === menu) journalMenu = null;
    });
    menu.showAtPosition({
        x: bounds.left,
        y: bounds.bottom,
        width: bounds.width,
    }, trigger.ownerDocument);
}

function openAnchorPicker() {
    const input = anchorInput.value;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
    }

    input.focus();
    input.click();
}

onBeforeUnmount(() => journalMenu?.hide());
</script>

<template>
    <header class="journalyst-context-header">
        <h2>
            <button
                type="button"
                class="journalyst-context-journal-button"
                aria-label="Change journal"
                title="Change journal"
                @click="openJournalMenu"
            >
                <span>{{ selectedJournalName }}</span>
                <ObsidianIcon name="chevron-down" />
            </button>
        </h2>

        <span class="journalyst-context-divider" aria-hidden="true">&middot;</span>

        <div class="journalyst-context-date-picker">
            <input
                ref="anchorInput"
                v-model="anchorDate"
                class="journalyst-context-date-input"
                type="date"
                tabindex="-1"
                aria-hidden="true"
            >
            <button
                type="button"
                class="journalyst-context-date-button"
                aria-label="Change anchor date"
                title="Change anchor date"
                @click="openAnchorPicker"
            >
                <span>{{ formattedAnchorDate }}</span>
                <ObsidianIcon name="chevron-down" />
            </button>
        </div>
    </header>
</template>

<style scoped>
.journalyst-context-header {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: var(--size-4-2);
    margin-bottom: var(--size-4-5);
    padding: var(--size-4-2) 0 var(--size-4-4);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-context-header h2 {
    min-width: 0;
    margin: 0;
    font-size: var(--h2-size);
    font-weight: var(--h2-weight);
}

.journalyst-context-journal-button,
.journalyst-context-date-button {
    display: inline-flex;
    width: auto;
    min-width: 0;
    height: auto;
    align-items: center;
    gap: var(--size-4-1);
    border: 0;
    background: transparent;
    box-shadow: none;
}

.journalyst-context-journal-button {
    max-width: min(100%, 28rem);
    padding: var(--size-4-1) var(--size-4-2);
    color: var(--text-normal);
    font: inherit;
    line-height: 1.2;
}

.journalyst-context-journal-button span,
.journalyst-context-date-button span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-context-divider {
    color: var(--text-faint);
}

.journalyst-context-date-picker {
    position: relative;
    display: inline-flex;
    min-width: 0;
}

.journalyst-context-date-input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
}

.journalyst-context-date-button {
    max-width: 100%;
    padding: var(--size-4-1) var(--size-4-2);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
}

.journalyst-context-journal-button:hover,
.journalyst-context-date-button:hover {
    background: var(--background-modifier-hover);
}

.journalyst-context-journal-button:hover {
    color: var(--text-accent);
}

.journalyst-context-date-button:hover {
    color: var(--text-normal);
}

.journalyst-context-journal-button:focus-visible,
.journalyst-context-date-button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@container (max-width: 34rem) {
    .journalyst-context-header {
        align-items: flex-start;
        flex-direction: column;
        gap: var(--size-4-1);
    }

    .journalyst-context-divider {
        display: none;
    }

    .journalyst-context-header h2,
    .journalyst-context-journal-button,
    .journalyst-context-date-picker,
    .journalyst-context-date-button {
        max-width: 100%;
    }

    .journalyst-context-header h2 {
        font-size: var(--font-ui-large);
    }
}
</style>
