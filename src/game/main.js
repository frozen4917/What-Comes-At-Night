/**
 * @file main.js
 * @description The Core Game Engine.
 * This file contains the high-level logic for the game loop, including:
 * - Initializing the game state from data.
 * - Orchestrating the Player's Turn (running actions).
 * - Orchestrating the Monster's Turn (spawning, attacks).
 * - Checking for Game Over / Win conditions.
 */

import { areConditionsMet } from './utils.js';
import { trapMonster, processFortificationDamage, processTimedEvents, processNoiseSpawning, processNoiseDespawning, processPlayerDamage } from "./monsterHandler.js";
import { handleEffects } from "./effectsHandler.js";

/**
 * Runs the monster's turn: Spawning, despawning, activating traps, and attacking fortifications
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function runMonsterTurn(gameState, gameData) {
    processTimedEvents(gameState, gameData); // Timed horde Spawning
    processNoiseSpawning(gameState, gameData); // High-noise lone monster spawning
    processNoiseDespawning(gameState, gameData); // Noise-spawned monsters despawning
    trapMonster(gameState, gameData); // Kills monsters if trap is set
    processFortificationDamage(gameState, gameData); // Monsters damage fortification
}

/**
 * Runs player's turn after player selects an action. Updates location, handles effects of the action, processes damage from monsters, and decrements the clock
 * @param {Object} chosenAction Action object chosen by the player from the validActions array
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function runPlayerTurn(chosenAction, gameState, gameData) {
    gameState.world.previousLocation = gameState.world.currentLocation; // Update previous turn's location

    handleEffects(chosenAction, gameState, gameData);   // Handles the effects of the chosen action
    processPlayerDamage(gameState, gameData);           // Monsters damage player
    tickClock(gameState);                               // Decrement actions remaining & cooldowns
}

/**
 * Check's for win / lose / phase change condition
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 * @returns {{ isGameOver: boolean, outcome?: 'win' | 'lose' }} status of the game and the outcome
 */
export function checkGameStatus(gameState, gameData) {
    // Check player health
    if (gameState.player.health <= 0) {
        return { isGameOver: true, outcome: 'lose' };
    }

    // If actionsRemaining is 0, trigger next phase
    if (gameState.world.actionsRemaining === 0) {
        // Find next phase
        const currentPhaseIndex = gameData.phases.phases.findIndex(phase => phase.id === gameState.world.currentPhaseId);
        const nextIndex = currentPhaseIndex + 1;

        // Check if there is a next phase
        if (nextIndex < gameData.phases.phases.length) {
            const nextPhase = gameData.phases.phases[nextIndex];
            gameState.world.currentPhaseId = nextPhase.id;
            gameState.world.actionsRemaining = nextPhase.durationInActions;
        } else {
            // This should not happen if 'dawn' is the last phase, but as a fallback:
            gameState.world.currentPhaseId = 'dawn'; // Force to dawn if list ends
        }
    }

    // Check if phase is 'dawn'
    if (gameState.world.currentPhaseId === 'dawn') {
        return { isGameOver: true, outcome: 'win' };
    }

    // If no conditions are met, the game continues
    return { isGameOver: false };
}

/**
 * Returns an array of all valid actions
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 * @returns {Object[]} Array of action objects
 */
export function getCurrentActions(gameState, gameData) {
    const validActions = [];
    const locationData = gameData.locations[gameState.world.currentLocation]; // Location specific data
    const globalData = gameData.globalActions; // Global options

    // Combined list of location-based and global actions
    const allMenuSources = [
        ...(locationData.menu || []),
        ...(globalData.menu || [])
    ];

    // Process all actions from both location and global files
    for (const category of allMenuSources) {
        for (const action of category.subActions) {
            // Check if the action's conditions (from showIf) are met by the current game state
            if (areConditionsMet(action.showIf, gameState, gameData)) {
                
                // Create the final action object and add it to the list
                validActions.push({
                    id: action.id,
                    category: category.category, // The category to which the action belongs to, e.g. "MOVE", "FORTIFY", etc.
                    displayText: gameData.texts[action.text_ref] || action.id, // Display text is the text shown on the option. Fallback to ID if text_ref is missing
                    effects: action.effects
                });
            }
        }
    }

    return validActions;
}

/**
 * Assembles gameState object from initialState.json and returns the new object
 * @param {Object} gameData Game-related data
 * @returns {Object} Assembled gameState object
 */
export function initializeGameState(gameData) {
    const initialState = gameData.initialState;

    // Step 1. Create the Player state
    const player = {
        ...initialState.player.initialStats,
        inventory: { ...initialState.player.initialInventory }
    };

    // Step 2. Create the World state
    const world = { ...initialState.world }; // Full copy
    world.flags = { ...initialState.world.flags }; // Deep copy flags
    world.fortifications = { ...initialState.world.fortifications }; // Deep copy fortifications
    world.traps = { ...initialState.world.traps }; // Deep copy traps
    world.visitedLocations = []; // Fresh arrays
    world.scavengedLocations = []; // Fresh arrays

    // Step 3. Find and set the actions for the first phase
    const firstPhaseData = gameData.phases.phases.find(p => p.id === world.currentPhaseId);
    if (!firstPhaseData) {
        console.error(`FATAL ERROR: Could not find phase data for initial phase ID: "${world.currentPhaseId}"`);
        throw new Error("Failed to find initial phase data.");
    }
    world.actionsRemaining = firstPhaseData.durationInActions;

    // Step 4. Create Horde and Status (fresh copies)
    const horde = JSON.parse(JSON.stringify(initialState.horde));
    const status = JSON.parse(JSON.stringify(initialState.status));
    // Ensure arrays are definitely empty if the JSON wasn't
    status.messageQueue = [];
    
    // Step 5. Assemble and return the complete gameState object
    return {
        player,
        world,
        horde,
        status
    };
}

/**
 * Decrements actions remaining, grace period cooldown, and repeated noise spawning cooldown
 * @param {Object} gameState Current dynamic game state
 */
function tickClock(gameState) {
    // Decrement actions remaining
    gameState.world.actionsRemaining -= 1;
    // Decrement grace period (spawn cooldown after kill)
    if (gameState.status.gracePeriodCooldown > 0) {
        gameState.status.gracePeriodCooldown -= 1;
    }
    // Decrement repeated spawn cooldown
    if (gameState.status.repeatedSpawnCooldown > 0) {
        gameState.status.repeatedSpawnCooldown -= 1;
    }
}