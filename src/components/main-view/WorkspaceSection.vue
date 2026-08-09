<script setup lang="ts">
defineProps<{
    title: string;
    description?: string;
}>();
</script>

<template>
    <section class="journalyst-review-section">
        <div class="journalyst-section-heading">
            <h2>{{ title }}</h2>
            <p v-if="description" class="journalyst-review-section-description">{{ description }}</p>
        </div>
        <slot />
    </section>
</template>
