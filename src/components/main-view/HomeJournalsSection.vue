<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { Menu } from "obsidian";
import type { ReviewWorkspaceTab } from "../../../review/types";
import type { JournalOverviewData } from "../../../review/buildHomeSnapshot";
import ObsidianIcon from "../ObsidianIcon.vue";
import JournalHomeCard from "./JournalHomeCard.vue";

type JournalFilter = 'all' | 'attention' | 'on-track' | 'ad-hoc';
type JournalSort = 'journal-order' | 'attention-first' | 'name';

const props = defineProps<{
    journals: JournalOverviewData[];
}>();

const emit = defineEmits<{
    createEntry: [target: { journalPath: string; date?: string }];
    activateTab: [target: { journalPath: string; tab: ReviewWorkspaceTab }];
    openSettings: [];
}>();

const activeFilter = ref<JournalFilter>('all');
const activeSort = ref<JournalSort>('journal-order');
const menuOpen = ref(false);
let filterMenu: Menu | null = null;

const filterLabels: Record<JournalFilter, string> = {
    all: 'All journals',
    attention: 'Needs attention',
    'on-track': 'On track',
    'ad-hoc': 'Ad hoc',
};

const sortLabels: Record<JournalSort, string> = {
    'journal-order': 'Journal order',
    'attention-first': 'Attention first',
    name: 'Name',
};

function needsAttention(overview: JournalOverviewData) {
    return overview.cardStatus.kind === 'due-today'
        || overview.cardStatus.kind === 'unfinished-today';
}

function isOnTrack(overview: JournalOverviewData) {
    return overview.isTracked && !needsAttention(overview);
}

const visibleJournals = computed(() => {
    const filtered = props.journals
        .map((overview, index) => ({ overview, index }))
        .filter(({ overview }) => {
            if (activeFilter.value === 'attention') return needsAttention(overview);
            if (activeFilter.value === 'on-track') return isOnTrack(overview);
            if (activeFilter.value === 'ad-hoc') return !overview.isTracked;
            return true;
        });

    if (activeSort.value === 'attention-first') {
        return filtered
            .sort((left, right) => {
                const leftRank = needsAttention(left.overview)
                    ? 0
                    : left.overview.isTracked ? 1 : 2;
                const rightRank = needsAttention(right.overview)
                    ? 0
                    : right.overview.isTracked ? 1 : 2;
                return leftRank - rightRank || left.index - right.index;
            })
            .map(({ overview }) => overview);
    }

    if (activeSort.value === 'name') {
        return filtered
            .sort((left, right) => left.overview.journal.name.localeCompare(
                right.overview.journal.name,
                undefined,
                { sensitivity: 'base' },
            ))
            .map(({ overview }) => overview);
    }

    return filtered.map(({ overview }) => overview);
});

const filterButtonLabel = computed(() =>
    `Filter and sort journals. Showing ${filterLabels[activeFilter.value]}, sorted by ${sortLabels[activeSort.value]}.`
);

function setFilter(filter: JournalFilter) {
    activeFilter.value = filter;
}

function setSort(sort: JournalSort) {
    activeSort.value = sort;
}

function resetFilter() {
    activeFilter.value = 'all';
}

function openFilterMenu(event: MouseEvent) {
    filterMenu?.hide();

    const trigger = event.currentTarget as HTMLButtonElement;
    const bounds = trigger.getBoundingClientRect();
    const menu = new Menu()
        .addItem(item => item
            .setTitle('Show')
            .setIsLabel(true))
        .addItem(item => item
            .setTitle('All journals')
            .setIcon('notebook-pen')
            .setChecked(activeFilter.value === 'all')
            .onClick(() => setFilter('all')))
        .addItem(item => item
            .setTitle('Needs attention')
            .setIcon('circle-alert')
            .setChecked(activeFilter.value === 'attention')
            .onClick(() => setFilter('attention')))
        .addItem(item => item
            .setTitle('On track')
            .setIcon('circle-check')
            .setChecked(activeFilter.value === 'on-track')
            .onClick(() => setFilter('on-track')))
        .addItem(item => item
            .setTitle('Ad hoc')
            .setIcon('shuffle')
            .setChecked(activeFilter.value === 'ad-hoc')
            .onClick(() => setFilter('ad-hoc')))
        .addSeparator()
        .addItem(item => item
            .setTitle('Sort')
            .setIsLabel(true))
        .addItem(item => item
            .setTitle('Journal order')
            .setIcon('list-ordered')
            .setChecked(activeSort.value === 'journal-order')
            .onClick(() => setSort('journal-order')))
        .addItem(item => item
            .setTitle('Attention first')
            .setIcon('arrow-up-wide-narrow')
            .setChecked(activeSort.value === 'attention-first')
            .onClick(() => setSort('attention-first')))
        .addItem(item => item
            .setTitle('Name')
            .setIcon('arrow-down-a-z')
            .setChecked(activeSort.value === 'name')
            .onClick(() => setSort('name')));

    filterMenu = menu;
    menuOpen.value = true;
    menu.onHide(() => {
        if (filterMenu === menu) {
            filterMenu = null;
            menuOpen.value = false;
        }
    });
    menu.showAtPosition({
        x: bounds.left,
        y: bounds.bottom,
        width: bounds.width,
    }, trigger.ownerDocument);
}

onBeforeUnmount(() => filterMenu?.hide());
</script>

<template>
    <section class="journalyst-journals-section">
        <header class="journalyst-journals-heading">
            <div class="journalyst-journals-heading-copy">
                <h2>Journals</h2>
                <p>Write today, scan the month, or jump into review.</p>
            </div>
            <button
                type="button"
                class="journalyst-journals-filter-button"
                :class="{ 'is-active': activeFilter !== 'all' || activeSort !== 'journal-order' }"
                aria-haspopup="menu"
                :aria-expanded="menuOpen"
                :aria-label="filterButtonLabel"
                :title="filterButtonLabel"
                @click="openFilterMenu"
            >
                <ObsidianIcon name="list-filter" />
                <span>Filter &amp; sort</span>
            </button>
        </header>

        <div v-if="visibleJournals.length" class="journalyst-journals-grid">
            <JournalHomeCard
                v-for="overview in visibleJournals"
                :key="overview.journal.path"
                :overview="overview"
                @create-entry="emit('createEntry', $event)"
                @activate-tab="emit('activateTab', $event)"
                @open-settings="emit('openSettings')"
            />
        </div>

        <div v-else class="journalyst-journals-empty" role="status">
            <p>No journals match this filter.</p>
            <button type="button" @click="resetFilter">Show all journals</button>
        </div>
    </section>
</template>

<style scoped>
.journalyst-journals-section {
    container-type: inline-size;
    margin-bottom: var(--size-4-7);
}

.journalyst-journals-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-4);
    margin-bottom: var(--size-4-3);
}

.journalyst-journals-heading-copy {
    display: flex;
    align-items: baseline;
    gap: var(--size-4-3);
    min-width: 0;
}

.journalyst-journals-heading h2,
.journalyst-journals-heading p {
    margin: 0;
}

.journalyst-journals-heading h2 {
    flex: none;
    font-size: var(--font-ui-medium);
    text-transform: uppercase;
    color: var(--text-muted);
}

.journalyst-journals-heading p {
    overflow: hidden;
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-journals-filter-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    gap: var(--size-4-2);
    min-height: var(--input-height);
    padding: 0 var(--size-4-3);
    color: var(--text-muted);
}

.journalyst-journals-filter-button.is-active {
    border-color: var(--interactive-accent);
    color: var(--text-normal);
}

.journalyst-journals-filter-button:focus-visible,
.journalyst-journals-empty button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

.journalyst-journals-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
    align-items: stretch;
    gap: var(--size-4-4);
}

.journalyst-journals-empty {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-4);
    min-height: 5rem;
    padding: var(--size-4-4);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-secondary);
}

.journalyst-journals-empty p {
    margin: 0;
    color: var(--text-muted);
}

@container (max-width: 34rem) {
    .journalyst-journals-heading-copy p {
        display: none;
    }
}

@container (max-width: 24rem) {
    .journalyst-journals-filter-button span {
        display: none;
    }

    .journalyst-journals-filter-button {
        width: var(--input-height);
        padding: 0;
    }

    .journalyst-journals-empty {
        align-items: stretch;
        flex-direction: column;
    }
}
</style>
