<script setup>
/**
 * @component ActionMenu
 * @description Dynamic action selection menu with category-based filtering
 * Displays available player actions organized into categories (MOVE, ATTACK, FORTIFY, etc.). Actions are filtered in real-time based on game state conditions (stamina, inventory, location, etc.).
 */

import { ref, computed, watch } from 'vue';
import { useGameStore } from '@/stores/gameStore';
import { generateTooltipText } from '@/game/ui.js';

const gameStore = useGameStore();

// --- STATE ---

// Tracks which category is currently expanded (e.g., "MOVE", "ATTACK")
const selectedCategory = ref(null);

// Tooltip state: visibility, position, and content
const tooltip = ref({
    visible: false,
    actionId: null, // Action to which the tooltip belongs to
    lines: [], // Array of info strings (e.g., ["Costs: 3 Stamina", "Stats: +60 HP"])
    position: { top: 0, right: 0 }
});

// --- COMPUTED PROPERTIES ---

/**
 * Fixed display order for action categories. Categories appear in this order regardless of which are available to ensure consistent muscle memory for players
 */
const categoryOrder = [
    'MOVE',
    'ATTACK',
    'FORTIFY',
    'REST & HIDE',
    'GATHER',
    'INTERACT & USE'
];

/**
 * Set of currently available categories based on valid actions. Each action is checked and it's category is added to the set, e.g. ["MOVE", "REST & HIDE", "ATTACK"]
 */
const availableCategories = computed(() => {
    return new Set(
        gameStore.validActions.map(action => action.category)
    );
});

/**
 * Filtered and ordered list of categories to display. Shows only categories that have at least one valid action, e.g: ["MOVE", "ATTACK", "REST & HIDE"]
 */
const actionCategories = computed(() => {
    return categoryOrder.filter(category =>
        availableCategories.value.has(category)
    );
});

/**
 * Actions belonging to the currently selected category.
 */
const subActions = computed(() => {
    if (!selectedCategory.value) {
        return []; // If no category is selected, show no sub-actions
    }
    return gameStore.validActions.filter(
        action => action.category === selectedCategory.value
    );
});

// --- FUNCTIONS ---

/**
 * Selects a category and closes any open tooltips.
 * @param {string} category Category ID (e.g., "MOVE")
 */
function selectCategory(category) {
    selectedCategory.value = category;
    closeTooltip(); // Close tooltip if open
}

/**
 * Hides tooltip and removes click listener.
 * Called when clicking outside tooltip or selecting an action.
 */
function closeTooltip() {
    tooltip.value.visible = false;
    tooltip.value.actionId = null;
    document.removeEventListener('click', closeTooltip);
}

/**
 * Handles player clicking an action button. Triggers the main game loop via store
 * @param {Object} action - Action object with id, effects, etc.
 */
function onActionClick(action) {
    closeTooltip(); // Close tooltip
    gameStore.handlePlayerAction(action); // Call the main game loop function in the store 
}

/**
 * Shows/hides tooltip for an action's info button (ⓘ).
 * Calculates position to appear above the button.
 * @param {Object} action Action to show info for
 * @param {Event} event Click event (to prevent bubbling)
 */
function onInfoClick(action, event) {
    event.stopPropagation(); // Prevent triggering action itself

    // Toggle: if same tooltip clicked again, close it
    if (tooltip.value.visible && tooltip.value.actionId === action.id) {
        closeTooltip();
    } else {
        const button = event.currentTarget;
        const rect = button.getBoundingClientRect();
        
        // Generate tooltip content (costs, damage, etc.)
        tooltip.value.lines = generateTooltipText(action, gameStore.gameState, gameStore.gameData);
        tooltip.value.visible = true;
        tooltip.value.actionId = action.id;
        
        // Position tooltip above button, aligned to right edge
        tooltip.value.position = {
            top: rect.top - 10,
            right: window.innerWidth - rect.right
        };

        // Close tooltip if user clicks anywhere else
        document.addEventListener('click', closeTooltip, { once: true });
    }
}

// --- WATCHERS ---

/**
 * Auto-selects appropriate category when action list changes.
 * 
 * Strategy:
 * 1. If current category is still valid, keep it selected (preserve UX)
 * 2. Otherwise, select the first available category
 * 3. If no categories available, deselect (should never happen in practice)
 */
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
        <!-- LEFT PANEL (CATEGORY BUTTONS) -->
        <nav id="action-categories">
            <button v-for="category in actionCategories" :key="category" class="action-button category-button"
                :class="{ active: category === selectedCategory }" @click="selectCategory(category)">
                {{ category }}
            </button>
        </nav>

        <!-- RIGHT PANEL: Action buttons for selected category -->
        <div id="action-sub-options">
            <ul class="sub-options-list">
                <li v-for="action in subActions" :key="action.id" class="sub-option-item">

                    <!-- Main action button -->
                    <button class="action-button" @click="onActionClick(action)">
                        {{ action.displayText }}
                    </button>

                    <!-- Tooltip button -->
                    <button class="info-button" @click.stop="onInfoClick(action, $event)">
                        ⓘ
                    </button>

                    <!-- Tooltip popup -->
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
/* Container for action list items */
.sub-options-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

/* Each action row: button + info icon */
.sub-option-item {
    position: relative; /* Anchor for the tooltip */
    display: flex;
    align-items: center;
    justify-content: space-between;
}

/* Main action button takes most horizontal space */
.sub-option-item .action-button {
    flex-grow: 1;
}
</style>