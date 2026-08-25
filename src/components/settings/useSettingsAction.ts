import { computed, ref } from 'vue';
import type { SettingsActionResult } from './types';

export function useSettingsAction() {
    const pendingKeys = ref(new Set<string>());
    const error = ref('');

    const pending = computed(() => pendingKeys.value.size > 0);

    async function run(key: string, action: () => Promise<SettingsActionResult>) {
        if (pendingKeys.value.has(key)) return false;
        pendingKeys.value = new Set(pendingKeys.value).add(key);
        error.value = '';
        try {
            const result = await action();
            if (!result.ok) {
                error.value = result.error ?? 'Journalyst could not save that setting.';
                return false;
            }
            return true;
        } catch (cause) {
            error.value = cause instanceof Error
                ? cause.message
                : 'Journalyst could not save that setting.';
            return false;
        } finally {
            const nextKeys = new Set(pendingKeys.value);
            nextKeys.delete(key);
            pendingKeys.value = nextKeys;
        }
    }

    function isPending(key: string) {
        return pendingKeys.value.has(key);
    }

    return { error, pending, run, isPending };
}
