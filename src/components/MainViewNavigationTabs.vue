<script setup lang="ts" generic="T extends string">
import { ref } from "vue";
import ObsidianIcon from "./ObsidianIcon.vue";

type Tab = {
    id: T;
    label: string;
    icon: string;
};

const props = defineProps<{
    tabs: Tab[];
}>();

const activeTab = defineModel<T>('activeTab', { required: true });
const tabList = ref<HTMLElement | null>(null);

function handleTabClick(tabId: T) {
    activeTab.value = tabId;
}

function handleKeydown(event: KeyboardEvent, currentIndex: number) {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % props.tabs.length;
    } else if (event.key === 'ArrowLeft') {
        nextIndex = (currentIndex - 1 + props.tabs.length) % props.tabs.length;
    } else if (event.key === 'Home') {
        nextIndex = 0;
    } else if (event.key === 'End') {
        nextIndex = props.tabs.length - 1;
    }

    if (nextIndex === null) {
        return;
    }

    event.preventDefault();
    const nextTab = props.tabs[nextIndex];
    const nextButton = tabList.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex];
    if (nextTab) {
        activeTab.value = nextTab.id;
        nextButton?.focus();
    }
}
</script>

<template>
    <div ref="tabList" class="journalyst-review-tabs" role="tablist" aria-label="Journalyst workspace">
        <button
            v-for="(tab, index) in tabs"
            :key="tab.id"
            type="button"
            class="journalyst-review-tab"
            :class="{ 'is-active': tab.id === activeTab }"
            role="tab"
            :aria-selected="tab.id === activeTab"
            :tabindex="tab.id === activeTab ? 0 : -1"
            @click="handleTabClick(tab.id)"
            @keydown="handleKeydown($event, index)"
        >
            <ObsidianIcon :name="tab.icon" />
            <span>{{ tab.label }}</span>
        </button>
    </div>
</template>

<style scoped>
.journalyst-review-tabs {
    display: flex;
    gap: 0.25rem;
    max-width: 100%;
    overflow-x: auto;
    margin: 0 0 1.25rem;
    padding: 0.25rem;
    border-radius: var(--radius-s);
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    scrollbar-width: thin;
}

.journalyst-review-tab {
    border: 0;
    background: transparent;
    color: var(--text-muted);
    padding: 0.5rem 0.85rem;
    border-radius: var(--radius-s);
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    flex: 0 0 auto;
    white-space: nowrap;
}

.journalyst-review-tab.is-active {
    background: var(--background-primary);
    color: var(--text-normal);
    box-shadow: inset 0 -2px 0 var(--interactive-accent);
}

.journalyst-review-tab:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}
</style>
