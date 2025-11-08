<script setup>
import { useGameStore } from '@/stores/gameStore';

const gameStore = useGameStore();
</script>

<template>
    <div id="options-overlay" class="overlay">
        <div class="overlay-content">
            <h2>Options</h2>

            <p>Game options will go here.</p>
            <p>(e.g., volume, text speed)</p>

            <button class="footer-button close-button" @click="gameStore.toggleOptions()">
                Close
            </button>
        </div>
    </div>
</template>

<style scoped>
.overlay {
    display: flex;
}
</style>