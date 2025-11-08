<script setup>
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';

// Get a reactive reference to our game store
const gameStore = useGameStore();

// This computed property finds the full phase name
const phaseName = computed(() => {
    if (!gameStore.gameData || !gameStore.gameState.world.currentPhaseId) {
        return 'Loading...';
    }

    const phaseId = gameStore.gameState.world.currentPhaseId;

    // Find the phase object in our gameData that matches the current ID
    const phaseData = gameStore.gameData.phases.phases.find(p => p.id === phaseId);

    // If we found it, return its name. If not, just show the ID as a fallback.
    return phaseData ? phaseData.name : phaseId;
});

// A computed property to calculate the total number of monsters
const totalMonsters = computed(() => {
    if (!gameStore.gameState.horde) {
        return 0;
    }
    return Object.values(gameStore.gameState.horde).reduce((sum, list) => sum + list.length, 0);
});
</script>

<template>
    <header id="stats-bar">
        <div class="stats-left">
            <div v-if="gameStore.gameState.world">
                <strong>Phase:</strong>
                <span class="value">{{ phaseName }}</span>
            </div>
            <div v-if="gameStore.gameState.world">
                <strong>Actions:</strong>
                <span class="value">{{ gameStore.gameState.world.actionsRemaining }}</span>
            </div>
        </div>

        <div class="stats-middle">
            <div v-if="totalMonsters > 0">
                <strong>Monsters:</strong> {{ totalMonsters }}
            </div>
        </div>

        <div class="stats-right">
            <div v-if="gameStore.gameState.player">
                <strong>HP:</strong>
                <span class="value" :class="{ critical: gameStore.gameState.player.health <= 15 }">
                    {{ gameStore.gameState.player.health }}
                </span>
            </div>
            <div v-if="gameStore.gameState.player">
                <strong>Stamina:</strong>
                <span class="value" :class="{ critical: gameStore.gameState.player.stamina <= 15 }">
                    {{ gameStore.gameState.player.stamina }}
                </span>
            </div>
            <div v-if="gameStore.gameState.world">
                <strong>Noise:</strong>
                <span class="value">{{ gameStore.gameState.world.noise }}</span>
            </div>
        </div>
    </header>
</template>

<style scoped>
/* "scoped" means these styles *only* apply to this component. */
.stats-middle div {
    /* This is the monster count */
    color: var(--accent-color);
    font-weight: bold;
}

/* NEW: We can override the global "value" style for the 
  monster count to remove the margin.
*/
.stats-middle strong {
    margin-right: 0;
}
</style>