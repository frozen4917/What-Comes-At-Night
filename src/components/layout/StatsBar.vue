<script setup>
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';

const gameStore = useGameStore();

// This computed property finds the full phase name
const phaseName = computed(() => {
    if (!gameStore.gameData || !gameStore.gameState.world.currentPhaseId) {
        return 'Loading...';
    }
    const phaseId = gameStore.gameState.world.currentPhaseId;
    const phaseData = gameStore.gameData.phases.phases.find(p => p.id === phaseId);
    return phaseData ? phaseData.name : phaseId;
});

// NEW: This computed property returns the URL for the phase icon
const phaseIconUrl = computed(() => {
    if (!gameStore.gameState.world.currentPhaseId) {
        return 'none';
    }
    const phaseId = gameStore.gameState.world.currentPhaseId;
    // This will create a path like '/icons/nightfall.png'
    return `url(/icons/${phaseId}.png)`;
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
                <strong>Actions Left:</strong>
                <span class="value">{{ gameStore.gameState.world.actionsRemaining }}</span>
            </div>
            <div v-if="totalMonsters > 0">
                <strong>Monsters:</strong>
                <span class_="value">{{ totalMonsters }}</span>
            </div>
        </div>

        <div class="stats-center-icon">
            <div class="phase-icon" :style="{ maskImage: phaseIconUrl, '-webkit-mask-image': phaseIconUrl }"
                :title="phaseName"></div>
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
.stats-center-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
}

.phase-icon {
    background-color: var(--accent-color);
    mask-image: var(--icon-url);
    mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center;

    -webkit-mask-image: var(--icon-url);
    -webkit-mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;

    /* UPDATED: Converted to rem */
    height: 6.0rem;
    width: 6.0rem;

    display: block;
}
</style>