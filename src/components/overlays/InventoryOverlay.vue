<script setup>
/**
 * @component InventoryOverlay
 * @description Overlay showing player's collected items with quantities
 * Displays all items in player's inventory with their counts.
 * Empty inventory shows friendly message instead of empty list.
 */

import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';

const gameStore = useGameStore();

// --- COMPUTED PROPERTIES ---

/**
 * Transforms inventory object into display-friendly array.
 * Input format (from gameState.player.inventory) - { wood: 3, axe: 1 }
 * Output format:
 * [ { id: 'wood', name: 'Wood', count: 3 }, { id: 'axe', name: 'Axe', count: 1 } ]
 * 
 * The transformation:
 * 1. Gets item IDs from inventory object keys
 * 2. Looks up display names from items.json
 * 3. Combines into array for v-for rendering
 * @returns {Object[]} Array of item objects with id, name, count
 */
const inventoryItems = computed(() => {
    const inventory = gameStore.gameState.player.inventory;
    const itemsData = gameStore.gameData.items;

    if (!inventory || !itemsData) {
        return [];
    }

    // Object.keys(inventory) returns array of item ids, e.g. ["wood", "axe"]
    return Object.keys(inventory).map(itemId => {
        const itemInfo = itemsData[itemId]; // Get the item's info from items.json
        return {
            id: itemId,
            name: itemInfo ? itemInfo.name : itemId, // Fallback to ID if name not found
            count: inventory[itemId]
        };
    });
});
</script>

<template>
    <div id="inventory-overlay" class="overlay">
        <div class="overlay-content">
            <h2>Inventory</h2>
            <!-- Item list (only shown if inventory has items) -->
            <div v-if="inventoryItems.length > 0">
                <ul class="inventory-list">
                    <li v-for="item in inventoryItems" :key="item.id">
                        {{ item.name }} (x{{ item.count }})
                    </li>
                </ul>
            </div>
            <!-- Empty inventory message -->
            <div v-else>
                <p>Your inventory is empty.</p>
            </div>
            <!-- Close button -->
            <button class="footer-button close-button" @click="gameStore.toggleInventory()">
                Close
            </button>
        </div>
    </div>
</template>

<style scoped>
/* Centered overlay using flexbox. Display controlled by v-if in App.vue, not CSS classes. */
.overlay {
    display: flex;
    justify-content: center;
    align-items: center;
}

.overlay-content {
    font-family: 'Special Elite', monospace;
}

/* Scrollable item list with fixed max-height. */
.inventory-list {
    max-height: 40rem;
    overflow-y: auto;
    padding-right: 1rem; /* Space for scrollbar */
}
</style>