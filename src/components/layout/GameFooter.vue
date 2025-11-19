<script setup>
/**
 * @component GameFooter
 * @description Bottom navigation bar with utility actions
 * 
 * Provides access to meta-game functions:
 * - Show Inventory: Shows all items the player has
 * - Options: Volume control, how-to-play guide
 * - Restart: Begins new game (with confirmation)
 */
import { useGameStore } from '@/stores/gameStore';

const gameStore = useGameStore();
</script>

<template>
    <nav id="game-footer">
        <!-- Opens inventory overlay -->
        <button class="footer-button" @click="gameStore.toggleInventory()">
            Show Inventory
        </button>
        <!-- Opens options overlay -->
        <button class="footer-button" @click="gameStore.toggleOptions()">
            Options
        </button>
        <!-- Opens restart confirmation overlay -->
        <button class="footer-button" @click="gameStore.toggleRestartConfirm()">
            Restart
        </button>
    </nav>
</template>

<style scoped>
/* All styling handled by global layout.css */
/* See /src/assets/layout.css section L5 */
</style>