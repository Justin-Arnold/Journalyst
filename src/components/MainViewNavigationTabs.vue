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
    <div ref="tabList" class="journalyst-review-tab-container" role="tablist" aria-label="Journalyst workspace">
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
.journalyst-review-tab-container {
    display: inline-flex;
    gap: var(--size-4-1);
    max-width: 100%;
    overflow-x: auto;
    padding: var(--size-4-1);
    border-radius: var(--tab-curve);
    background: var(--journalyst-base-recessed);
    border: var(--tab-outline-width) solid var(--tab-outline-color);
    scrollbar-width: thin;
}

.journalyst-review-tab {
    background: transparent;
    border-radius: var(--tab-radius);
    box-shadow: none;
    color: var(--tab-text-color);
    flex: 0 0 auto;
    font-size: var(--tab-font-size);
    font-weight: var(--tab-font-weight);
    gap: var(--size-4-1);
    padding: var(--size-4-2) var(--size-4-3);
    white-space: nowrap;
}

.journalyst-review-tab.is-active {
    background: var(--journalyst-accent-dark);
    color: var(--color-accent-2);
}

.journalyst-review-tab:hover {
    color: var(--color-accent-1);
}

.journalyst-review-tab:focus-visible {
    outline: var(--border-width) solid var(--color-accent);
    outline-offset: var(--size-2-1);
}
</style>
