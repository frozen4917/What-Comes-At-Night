/**
 * @file gameStore.js
 * @description The Main Game Controller (Pinia Store).
 * This file acts as the bridge between the Vue UI components and the pure JS Game Engine.
 * It is responsible for:
 * - Managing the reactive state of the game (player, world, UI status).
 * - Persisting game state to localStorage.
 * - Handling user input
 * - Coordinating the game loop (Player Turn -> Monster Turn -> UI Update).
 * - Managing UI overlays and settings (Volume).
 */

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

// --- Game Engine Imports ---
import * as audio from '@/game/audioService.js';
import { loadGameData } from '@/game/loader.js'
import { 
    initializeGameState,
    getCurrentActions,
    runPlayerTurn, 
    runMonsterTurn, 
    checkGameStatus 
} from '@/game/main.js'
import { buildPromptText } from '@/game/ui.js'
import { renderText, getRandomText } from '@/game/utils.js'

const SAVE_GAME_KEY = 'wcan_saveGame'; // For saving game data
const SETTINGS_KEY = 'wcan_settings'; // For saving volume
const MAX_VOLUME = 0.3; // 100% maps to 0.3 

/**
 * The Main Game Store. This Pinia store acts as the "Controller" for the application.
 * It holds the Single Source of Truth for the game state and exposes actions to modify it.
 */
export const useGameStore = defineStore('game', () => {

    // --- STATE ---
    /**
     * The static "Rulebook" loaded from JSON files. Contains all item definitions, monster stats, texts, and settings. Read-only after load.
     * @type {import('vue').Ref<Object|null>}
     */
    const gameData = ref(null);

    /**
     * The dynamic "Save File". Contains the player's current stats, inventory, world state, and active monsters. This is the object that gets saved to localStorage.
     * @type {import('vue').Ref<Object>}
     */
    const gameState = ref({
        player: {},
        world: {},
        horde: {},
        status: {}
    });

    /**
     * The list of actions currently available to the player. Calculated by the Engine based on the current state.
     * @type {import('vue').Ref<Array<Object>>}
     */
    const validActions = ref([]);

    /**
     * The main story text displayed in the center panel. Includes timeline flavor, location description, and action results.
     * @type {import('vue').Ref<string>}
     */
    const promptText = ref("");

    // --- UI OVERLAY STATE ---
    const isInventoryOpen = ref(false); // Controls visibility of the inventory overlay
    const isOptionsOpen = ref(false); // Controls visibility of the options overlay
    const isGameOver = ref(false); // Controls the game over state. When true, the main UI is hidden and a end-game overlay is shown
    const isRestartConfirmOpen = ref(false); // Controls visibility of the restart confirmation popup

    // --- SETTINGS ---
    const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const volume = ref(savedSettings.volume !== undefined ? savedSettings.volume : 100);

    /**
     * Deeply observes the `gameState` object for any changes. Whenever the state changes, it serializes the state to JSON and saves it to localStorage.
     */
    watch(gameState, (newGameState) => {
        
        // Check for a "game over" state. If the player is dead or has won,
        // DO NOT save the game. This prevents the "zombie" state on reload.
        if (newGameState.player.health <= 0 || newGameState.world.currentPhaseId === 'dawn') {
            return; // Stop here, do not save
        }

        // Stringify the object to save it as a string in localStorage.
        localStorage.setItem(SAVE_GAME_KEY, JSON.stringify(newGameState));
    }, { deep: true });
    

    // --- INTERNAL HELPER FUNCTIONS ---
    // These functions begin with '_' and are solely used in here.

    /**
     * Generates new prompt text and fetches the valid actions for the current turn.
     */
    function _updateUI() {
        if (!gameState.value || !gameData.value) return;

        // Get new text from the engine
        promptText.value = buildPromptText(gameState.value, gameData.value);
        
        // Get new actions from the engine
        validActions.value = getCurrentActions(gameState.value, gameData.value);
    }

    /**
     * Constructs the final text to be displayed on the Game Over / Win screen. Combines pending consequence messages with the specific win/loss outcome text.
     * @param {'win' | 'lose'} outcome The result of the game ('win' or 'lose').
     * @returns {string} The formatted end-game text block.
     */
    function _buildEndGameText(outcome) {
        const finalMessages = [];

        // 1. Get any leftover messages from the queue
        if (gameState.value.status.messageQueue && gameState.value.status.messageQueue.length > 0) {
            // Loop through all leftover messages
            for (const messageObject of gameState.value.status.messageQueue) {
                const template = getRandomText(messageObject.text_ref, gameData.value); // Get the template string from texts.json
                if (template) {
                    finalMessages.push(renderText(template, messageObject.params)); // Replace all placeholders with the values in params object
                }
            }
        }
        
        // 2. Add the specific win/loss text
        if (outcome === 'lose') {
            finalMessages.push(getRandomText("game_over_lose", gameData.value)); // Get the lose text and push it into the finalMessages array
        } else if (outcome === 'win') {
            finalMessages.push(gameData.value.texts.phase_intro_dawn); // Get the win text and push it into the finalMessages array

            const totalMonsters = Object.values(gameState.value.horde).reduce((sum, list) => sum + list.length, 0);
            if (totalMonsters > 0) {
                // Atleast one monster was alive when it became dawn. Get a special text and add it into the array
                finalMessages.push(getRandomText("game_over_win_monsters", gameData.value));
            }
            if (gameState.value.player.health <= 15) {
                // Player won with <= 15 HP. Get a special text and add it into the array
                finalMessages.push(getRandomText("game_over_win_critical", gameData.value));
            } else {
                // Player won with more than enough HP. Add the normal text
                finalMessages.push(getRandomText("game_over_win_normal", gameData.value));
            }
        }
        
        // 3. Join it all together
        return finalMessages.join('\n\n'); // Use newlines for final display
    }

    /**
     * Calculates the actual volume based on the UI slider (0-100) and the defined MAX_VOLUME constant, then updates the Audio Service. Saves the setting to localStorage.
     */
    function _setVolume() {
        // This maps 0-100 slider to 0-0.3 real volume scale
        const actualVolume = (volume.value / 100) * MAX_VOLUME;
        audio.setMasterVolume(actualVolume); // Set the volume
        
        // Save the setting
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ volume: volume.value }));
    };

    // --- CORE GAME FUNCTIONS ---
    // These functions run the action game loop.

    /**
     * Initializes the game session. Loads static game data, checks for an existing save, and sets up the initial state.
     * If a save exists, it loads it; otherwise, it starts a fresh game.
     */
    async function startGame() {
        try {
            // Step 1. Fetch and set volume
            _setVolume();

            // Step 2. Load all game data (the "Rulebook")
            gameData.value = await loadGameData();
            
            // Step 3. Initialize the game state
            // (a) Check for saved game in localStorage
            const savedGame = localStorage.getItem(SAVE_GAME_KEY);
            
            if (savedGame) {
                // (b) If a save exists, load it
                gameState.value = JSON.parse(savedGame);
            } else {
                // (c) If no save, initialize a fresh game
                gameState.value = initializeGameState(gameData.value);
                
                // Only run the monster turn on a *brand new* game
                runMonsterTurn(gameState.value, gameData.value);
            }

            // Step 4. Update the UI with initial text and actions
            _updateUI();

            // Step 5. Play the music for the phase the game loaded into
            const currentPhaseData = gameData.value.phases.phases.find(p => p.id === gameState.value.world.currentPhaseId);
            audio.playMusic(currentPhaseData.musicTrack);

        } catch (error) {
            console.error("Game Store: Failed to start game", error);
            promptText.value = "FATAL ERROR: Could not start game. Check console for details.";
        }
    }

    /**
     * The central input handler for the game. It is called whenever the player clicks an action button.
     * Executes the game loop:
     * 1. Runs Player Turn (Engine)
     * 2. Checks Game Status (Win/Loss)
     * 3. If game continues, runs Monster Turn (Engine)
     * 4. Updates UI State
     * @param {object} chosenAction Action object selected by the player.
     */
    function handlePlayerAction(chosenAction) {
        if (isGameOver.value) return; // Don't do anything if the game is over
                
        // Step 1. Run the Player's turn (handles effects, damage, clock)
        runPlayerTurn(chosenAction, gameState.value, gameData.value);
        
        // Step 2. Check for win/loss/phase change
        const status = checkGameStatus(gameState.value, gameData.value);

        // Step 3. Handle the result (Controller logic)
        if (status.isGameOver) {
            isGameOver.value = true;
            promptText.value = _buildEndGameText(status.outcome); // Prepare the end game text

            localStorage.removeItem(SAVE_GAME_KEY); // Remove the local save as the game is over

            // Handle end-game music. Play dawn track if "win"
            if (status.outcome === 'win') {
                const dawnPhaseData = gameData.value.phases.phases.find(p => p.id === 'dawn');
                if (dawnPhaseData.musicTrack) {
                    audio.playMusic(dawnPhaseData.musicTrack);
                }
            }
        } else {
            // Run monster's turn (spawning/despawning, fortification damage)
            runMonsterTurn(gameState.value, gameData.value);
            // Step 4. Update the UI for the next turn
            _updateUI();

            // Check for and play new music for the new phase
            const newPhaseData = gameData.value.phases.phases.find(p => p.id === gameState.value.world.currentPhaseId);
            if (newPhaseData.musicTrack) {
                // Play new track on phase change. If the track is the same or doesn't exist, Howler will just keep playing it.
                audio.playMusic(newPhaseData.musicTrack);
            }
        }
    }


    // --- UI HELPER FUNCTIONS ---

    /**
     * Toggles the visibility of the Inventory Overlay.
     */
    function toggleInventory() {
        isInventoryOpen.value = !isInventoryOpen.value;
    }

    /**
     * Toggles the visibility of the Options Overlay.
     */
    function toggleOptions() {
        isOptionsOpen.value = !isOptionsOpen.value;
    }

    /**
     * Toggles the visibility of the Restart confirmation popup.
     */
    function toggleRestartConfirm() {
        isRestartConfirmOpen.value = !isRestartConfirmOpen.value;
    };

    /**
     * Hard resets the game by deleting the same file, stopping music, and reloading the browser page.
     */
    function restartGame() {
        // 1. Delete the save file
        localStorage.removeItem(SAVE_GAME_KEY);
        // 2. Stop all music
        audio.stopAllMusic();
        // 3. Reload the page
        location.reload();
    };

    /**
     * Updates volume based on the slider in OptionsOverlay.
     * @param {string} newVolume The new value from the slider (0-100)
     */
    function updateVolume(newVolume) {
        volume.value = parseInt(newVolume, 10);
        _setVolume();
    };


    // --- This exposes our state and functions to the components ---
    return {
        // States
        gameState,
        gameData,
        validActions,
        promptText,
        isInventoryOpen,
        isOptionsOpen,
        isGameOver,
        isRestartConfirmOpen,
        volume,

        // Functions
        startGame,
        handlePlayerAction,
        toggleInventory,
        toggleOptions,
        toggleRestartConfirm,
        restartGame,
        updateVolume
    };
})