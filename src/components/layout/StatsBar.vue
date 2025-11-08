<script setup>
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';

// Get a reactive reference to our game store
const gameStore = useGameStore();

// A computed property to calculate the total number of monsters
const totalMonsters = computed(() => {
    if (!gameStore.gameState.horde) {
        return 0;
    }
    // This is the same logic from your original game
    return Object.values(gameStore.gameState.horde).reduce((sum, list) => sum + list.length, 0);
});
</script>

<template>
    <header id="stats-bar">
        <div class="stats-left">
            <div v-if="gameStore.gameState.world">
                <strong>Phase:</strong> {{ gameStore.gameState.world.currentPhaseId }}
            </div>
            <div v-if="gameStore.gameState.world">
                <strong>Actions:</strong> {{ gameStore.gameState.world.actionsRemaining }}
            </div>
        </div>
        <div class="stats-middle">
            <div v-if="totalMonsters > 0">
                <strong>Monsters:</strong> {{ totalMonsters }}
            </div>
        </div>
        <div class="stats-right">
            <div v-if="gameStore.gameState.player">
                <strong>HP:</strong> {{ gameStore.gameState.player.health }}
            </div>
            <div v-if="gameStore.gameState.player">
                <strong>Stamina:</strong> {{ gameStore.gameState.player.stamina }}
            </div>
            <div v-if="gameStore.gameState.world">
                <strong>Noise:</strong> {{ gameStore.gameState.world.noise }}
            </div>
        </div>
    </header>
</template>

<style scoped>
/* "scoped" means these styles *only* apply to this component.
  This is useful for adding component-specific tweaks.
  We'll make the monster count red to match the theme.
*/
.stats-middle div {
    color: var(--accent-color);
    font-weight: bold;
}
</style>