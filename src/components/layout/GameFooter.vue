<script setup>
import { useGameStore } from '@/stores/gameStore';

// Get a reactive reference to our game store
const gameStore = useGameStore();
</script>

<template>
    <nav id="game-footer">
        <button class="footer-button" @click="gameStore.toggleInventory()">
            Show Inventory
        </button>
        <button class="footer-button" @click="gameStore.toggleOptions()">
            Options
        </button>
        <button class="footer-button" @click="gameStore.restartGame()">
            Restart
        </button>
    </nav>
</template>

<style scoped>
/* No extra styles needed, the global themes.css handles this */
</style>