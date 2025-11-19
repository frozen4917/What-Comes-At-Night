<script setup>
/**
 * @component StatsBar
 * @description Top status bar showing game state at a glance
 * 
 * Displays critical information in three columns:
 * - LEFT: Phase, Actions Remaining, Monster Count, Current Location
 * - CENTER: Phase icon (visual indicator, changes with phase)
 * - RIGHT: Health, Stamina, Fortification HP, Noise Level
 */

import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';

const gameStore = useGameStore();

// --- COMPUTED PROPERTIES ---

/**
 * Retrieves the human-readable phase name (e.g., "Dusk", "Witching Hour").
 * @returns {string} Phase name or "Loading..." if data not ready
 */
const phaseName = computed(() => {
    if (!gameStore.gameData || !gameStore.gameState.world.currentPhaseId) {
        return 'Loading...';
    }
    const phaseId = gameStore.gameState.world.currentPhaseId;
    const phaseData = gameStore.gameData.phases.phases.find(p => p.id === phaseId);
    return phaseData ? phaseData.name : phaseId;
});

/**
 * Constructs CSS url() for the phase icon image used in CSS mask-image property to create theme-colored icons, e.g. 'url(/icons/nightfall.png)'
 * The mask technique allows single icon assets to adapt to any theme color without needing multiple colored versions.
 * @returns {string} CSS url() value or 'none' if phase not loaded
 */
const phaseIconUrl = computed(() => {
    if (!gameStore.gameState.world.currentPhaseId) {
        return 'none';
    }
    const phaseId = gameStore.gameState.world.currentPhaseId;
    // This will create a path like '/icons/nightfall.png'
    return `url(/icons/${phaseId}.png)`;
});


/**
 * Counts total monsters
 * @returns {number} Total monster count
 */
const totalMonsters = computed(() => {
    if (!gameStore.gameState.horde) {
        return 0;
    }
    return Object.values(gameStore.gameState.horde).reduce((sum, list) => sum + list.length, 0);
});

/**
 * Maps location IDs to their corresponding fortification IDs.
 */
const fortificationMap = {
    'campsite': 'campGate',
    'cabin': 'cabin',
    'graveyard': 'graveyardGate'
};

/**
 * Gets the human-readable location name for display.
 * @returns {string} Location display name
 */
const locationName = computed(() => {
    if (!gameStore.gameData) return 'Loading...';
    const locationId = gameStore.gameState.world.currentLocation;
    return gameStore.gameData.locations[locationId]?.name || locationId;
});

/**
 * Retrieves fortification HP for the player's current location.
 */
const fortificationHP = computed(() => {
    const locationId = gameStore.gameState.world.currentLocation;
    const fortId = fortificationMap[locationId]; // e.g., 'campGate'
    
    if (fortId) {
        return gameStore.gameState.world.fortifications[fortId];
    }
    return null; // No fortification at this location (should not be possible)
});
</script>

<template>
    <header id="stats-bar">
        <!-- LEFT COLUMN: Game state info (phase, actions left, monster count, location) -->
        <div class="stats-left">
            <!-- Current phase name -->
            <div v-if="gameStore.gameState.world">
                <strong>Phase:</strong>
                <span class="value">{{ phaseName }}</span>
            </div>
            <!-- Actions left -->
            <div v-if="gameStore.gameState.world">
                <strong>Actions Left:</strong>
                <span class="value">{{ gameStore.gameState.world.actionsRemaining }}</span>
            </div>
            <!-- Total no. of monsters. Only visible if there is atleast 1 monster -->
            <div v-if="totalMonsters > 0">
                <strong>Monsters:</strong>
                <span class_="value">{{ totalMonsters }}</span>
            </div>
            <!-- Player's location -->
            <div v-if="gameStore.gameState.world">
                <strong>Location:</strong>
                <span class="value">{{ locationName }}</span>
            </div>
        </div>

        <!-- CENTER COLUMN: Phase icon -->
        <div class="stats-center-icon">
            <div class="phase-icon" :style="{ maskImage: phaseIconUrl, '-webkit-mask-image': phaseIconUrl }"
                :title="phaseName"></div>
        </div>

        <!-- RIGHT COLUMN: Player Stats -->
        <div class="stats-right">
            <!-- Player's Health (critical pulse if below 15) -->
            <div v-if="gameStore.gameState.player">
                <strong>HP:</strong>
                <span class="value" :class="{ critical: gameStore.gameState.player.health <= 15 }">
                    {{ gameStore.gameState.player.health }}
                </span>
            </div>
            <!-- Player's Stamina (critical pulse if below 15) -->
            <div v-if="gameStore.gameState.player">
                <strong>Stamina:</strong>
                <span class="value" :class="{ critical: gameStore.gameState.player.stamina <= 15 }">
                    {{ gameStore.gameState.player.stamina }}
                </span>
            </div>
            <!-- Fortification HP at player's location -->
            <div v-if="gameStore.gameState.world">
                <strong>Fortification HP:</strong>
                <span class="value">{{ fortificationHP }}</span>
            </div>
            <!-- Noise levels -->
            <div v-if="gameStore.gameState.world">
                <strong>Noise:</strong>
                <span class="value">{{ gameStore.gameState.world.noise }}</span>
            </div>
        </div>
    </header>
</template>

<style scoped>
/* Center column's icon container */
.stats-center-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
}

/**
 * Phase icon styling using CSS mask technique.
 * How it works:
 * 1. background-color: Theme color (changes with phase)
 * 2. mask-image: PNG icon shape
 * 3. Result: Theme color visible only where icon is opaque
 * This allows one set of icons to work with all theme colors.
 * Browser support: mask-image (modern), -webkit-mask-image (Safari)
 */
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

    height: 6.0rem;
    width: 6.0rem;
    display: block;
}
</style>