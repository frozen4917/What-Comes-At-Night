<script setup>
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';

const gameStore = useGameStore();

// This computed property transforms your inventory object (e.g., { wood: 2 })
// into a user-friendly array (e.g., [{ name: "Wood", count: 2 }])
const inventoryItems = computed(() => {
    const inventory = gameStore.gameState.player.inventory;
    const itemsData = gameStore.gameData.items;

    if (!inventory || !itemsData) {
        return [];
    }

    // Object.keys(inventory) gives us ["wood", "bandages", etc.]
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

            <div v-if="inventoryItems.length > 0">
                <ul class="inventory-list">
                    <li v-for="item in inventoryItems" :key="item.id">
                        {{ item.name }} (x{{ item.count }})
                    </li>
                </ul>
            </div>
            <div v-else>
                <p>Your inventory is empty.</p>
            </div>

            <button class="footer-button close-button" @click="gameStore.toggleInventory()">
                Close
            </button>
        </div>
    </div>
</template>

<style scoped>
.overlay {
    display: flex;
    justify-content: center;
    align-items: center;
}

.overlay-content {
    font-family: 'Special Elite', monospace;
}

.inventory-list {
    max-height: 40rem; /* Was 40vh */
    overflow-y: auto;
    padding-right: 1rem; /* Was 10px */
}
</style>