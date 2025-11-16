<script setup>
import { ref, computed, watch } from 'vue';
import { useGameStore } from '@/stores/gameStore';
import { generateTooltipText } from '@/game/ui.js';
// Get a reactive reference to our game store
const gameStore = useGameStore();

// This ref will store the ID of the currently selected category (e.g., "MOVE")
const selectedCategory = ref(null);

const tooltip = ref({
    visible: false,
    actionId: null,
    lines: [],
    position: { top: 0, right: 0 }
});

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

// 3. This is our new list of categories. It filters the master list to only show categories that are currently available.
const actionCategories = computed(() => {
    return categoryOrder.filter(category =>
        availableCategories.value.has(category)
    );
});

// ---------------------------------

// This computed property filters the actions to show only the ones for the currently selected category.
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
    closeTooltip();
}

function closeTooltip() {
    tooltip.value.visible = false;
    tooltip.value.actionId = null;
    document.removeEventListener('click', closeTooltip);
}

// This function is called when an action is clicked
function onActionClick(action) {
    // Close the tooltip
    closeTooltip();
    // Call the main game loop function in the store
    gameStore.handlePlayerAction(action);

    // We no longer deselect the category, so the list just updates
}

// Activate tooltip
function onInfoClick(action, event) {
    event.stopPropagation();

    if (tooltip.value.visible && tooltip.value.actionId === action.id) {
        closeTooltip();
    } else {
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        
        tooltip.value.lines = generateTooltipText(action, gameStore.gameState, gameStore.gameData);
        tooltip.value.visible = true;
        tooltip.value.actionId = action.id;
        
        // Position tooltip above the button
        tooltip.value.position = {
            top: rect.top - 10, // Position above button with 10px spacing
            right: window.innerWidth - rect.right
        };

        document.addEventListener('click', closeTooltip, { once: true });
    }
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
            <ul class="sub-options-list">
                <li v-for="action in subActions" :key="action.id" class="sub-option-item">

                    <button class="action-button" @click="onActionClick(action)">
                        {{ action.displayText }}
                    </button>

                    <button class="info-button" @click.stop="onInfoClick(action, $event)">
                        ⓘ
                    </button>

                    <div class="tooltip-popup" v-if="tooltip.visible && tooltip.actionId === action.id"
                        :style="{ top: tooltip.position.top + 'px', right: tooltip.position.right + 'px' }"
                        @click.stop>
                        <div v-for="(line, index) in tooltip.lines" :key="index" class="tooltip-line">
                            {{ line }}
                        </div>
                    </div>
                </li>
            </ul>
        </div>
    </footer>
</template>

<style scoped>
.sub-options-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.sub-option-item {
    position: relative;
    /* Anchor for the tooltip */
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.sub-option-item .action-button {
    flex-grow: 1;
    /* Make button take up most space */
}
</style>