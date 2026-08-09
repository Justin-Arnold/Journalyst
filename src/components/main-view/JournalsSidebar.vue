<script setup lang="ts">
import type { JournalSettingsSidebarItem } from '../../../journalSettings';
import ObsidianIcon from '../ObsidianIcon.vue';

defineProps<{
    journals: JournalSettingsSidebarItem[];
    activeJournalPath: string | null;
}>();

defineEmits<{
    select: [journalPath: string];
    create: [];
}>();

function getMetadata(journal: JournalSettingsSidebarItem) {
    return journal.hasReminders
        ? `${journal.cadenceLabel} · reminders`
        : journal.cadenceLabel;
}

function getAccessibleLabel(journal: JournalSettingsSidebarItem) {
    return [journal.name, getMetadata(journal)].join(', ');
}
</script>

<template>
    <aside class="journalyst-journals-sidebar" aria-label="Journals">
        <header class="journalyst-journals-sidebar-header">
            <span>Journals</span>
            <span :aria-label="`${journals.length} journals`">{{ journals.length }}</span>
        </header>

        <ul class="journalyst-journals-sidebar-list">
            <li v-for="journal in journals" :key="journal.path">
                <button
                    type="button"
                    class="journalyst-journals-sidebar-row"
                    :class="{ 'is-active': journal.path === activeJournalPath }"
                    :aria-current="journal.path === activeJournalPath ? 'page' : undefined"
                    :aria-label="getAccessibleLabel(journal)"
                    @click="$emit('select', journal.path)"
                >
                    <ObsidianIcon name="notebook-pen" class="journalyst-journals-sidebar-icon" />
                    <span class="journalyst-journals-sidebar-copy">
                        <span class="journalyst-journals-sidebar-name" :title="journal.name">
                            {{ journal.name }}
                        </span>
                        <span class="journalyst-journals-sidebar-meta">
                            {{ getMetadata(journal) }}
                        </span>
                    </span>
                </button>
            </li>
        </ul>

        <footer class="journalyst-journals-sidebar-footer">
            <button type="button" @click="$emit('create')">
                <ObsidianIcon name="plus" />
                <span>New journal</span>
            </button>
        </footer>
    </aside>
</template>

<style scoped>
.journalyst-journals-sidebar {
    position: sticky;
    top: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 100%;
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-journals-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-3);
    padding: var(--size-4-4) var(--size-4-4) var(--size-4-2);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    letter-spacing: 0;
    text-transform: uppercase;
}

.journalyst-journals-sidebar-list {
    min-height: 0;
    margin: 0;
    padding: var(--size-4-2);
    overflow-y: auto;
    scrollbar-width: thin;
}

.journalyst-journals-sidebar-list li {
    margin: 0;
    list-style: none;
}

.journalyst-journals-sidebar-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--size-4-3);
    width: 100%;
    min-height: 3.75rem;
    padding: var(--size-4-2) var(--size-4-3);
    border: 0;
    box-shadow: none;
    background: transparent;
    color: var(--text-muted);
    text-align: left;
}

.journalyst-journals-sidebar-row:hover,
.journalyst-journals-sidebar-row.is-active {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

.journalyst-journals-sidebar-row.is-active .journalyst-journals-sidebar-icon,
.journalyst-journals-sidebar-row.is-active .journalyst-journals-sidebar-name {
    color: var(--text-accent);
}

.journalyst-journals-sidebar-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-4-1);
}

.journalyst-journals-sidebar-name,
.journalyst-journals-sidebar-meta {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.journalyst-journals-sidebar-name {
    color: var(--text-normal);
    font-size: var(--font-ui-medium);
    font-weight: var(--font-medium);
}

.journalyst-journals-sidebar-meta {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
}

.journalyst-journals-sidebar-footer {
    padding: var(--size-4-2);
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-journals-sidebar-footer button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--size-4-2);
    width: 100%;
    min-height: var(--input-height);
    border: 0;
    box-shadow: none;
    background: transparent;
    color: var(--text-muted);
}

.journalyst-journals-sidebar-footer button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

.journalyst-journals-sidebar-row:focus-visible,
.journalyst-journals-sidebar-footer button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: -2px;
}

@media (max-width: 760px) {
    .journalyst-journals-sidebar {
        display: none;
    }
}
</style>
