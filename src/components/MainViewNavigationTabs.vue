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
