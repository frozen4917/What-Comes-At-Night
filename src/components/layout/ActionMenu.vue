<script setup>
import { ref, computed, watch } from 'vue';
import { useGameStore } from '@/stores/gameStore';

// Get a reactive reference to our game store
const gameStore = useGameStore();

// This ref will store the ID of the currently selected category (e.g., "MOVE")
const selectedCategory = ref(null);

// --- NEW LOGIC FOR CATEGORIES ---

// 1. This is our desired, fixed order
const categoryOrder = [
    'MOVE',
    'ATTACK',
    'FORTIFY',
    'REST & HIDE',
    'GATHER',
    'INTERACT & USE'
];

// 2. This computed property creates a unique list of *available* categories
const availableCategories = computed(() => {
    return new Set(
        gameStore.validActions.map(action => action.category)
    );
});

// 3. This is our new list of categories. It filters the master list
//    to only show categories that are currently available.
const actionCategories = computed(() => {
    return categoryOrder.filter(category =>
        availableCategories.value.has(category)
    );
});

// ---------------------------------

// This computed property filters the actions to show only the ones
// for the currently selected category.
const subActions = computed(() => {
    if (!selectedCategory.value) {
        return []; // If no category is selected, show no sub-actions
    }
    return gameStore.validActions.filter(
        action => action.category === selectedCategory.value
    );
});

// This function is called when a category button is clicked
function selectCategory(category) {
    selectedCategory.value = category;
}

// This function is called when an action is clicked
function onActionClick(action) {
    // Call the main game loop function in the store
    gameStore.handlePlayerAction(action);

    // We no longer deselect the category, so the list just updates
}

// Automatically select the first category in the list whenever the actions change
watch(actionCategories, (newCategories) => {
    // If the currently selected category is still valid, don't change it
    if (newCategories.includes(selectedCategory.value)) {
        return;
    }

    // Otherwise, select the first available category
    if (newCategories.length > 0) {
        selectedCategory.value = newCategories[0];
    } else {
        selectedCategory.value = null;
    }
}, { immediate: true });

</script>

<template>
    <footer id="action-menu">
        <nav id="action-categories">
            <button v-for="category in actionCategories" :key="category" class="action-button category-button"
                :class="{ active: category === selectedCategory }" @click="selectCategory(category)">
                {{ category }}
            </button>
        </nav>
        <div id="action-sub-options">
            <button v-for="action in subActions" :key="action.id" class="action-button" @click="onActionClick(action)">
                {{ action.displayText }}
            </button>
        </div>
    </footer>
</template>

<style scoped>
/* No styles needed here */
</style>