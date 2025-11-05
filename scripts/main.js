import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });

import { loadGameData } from './loader.js';
import { updateConsoleUI, buildPromptText } from './ui.js';
import { getRandomInt, areConditionsMet, renderText } from './utils.js';
import { trapMonster, processFortificationDamage, processTimedEvents, processNoiseSpawning, processNoiseDespawning, processPlayerDamage } from "./monsterHandler.js";
import { handleEffects } from "./effectsHandler.js";



// Fetches available actions
export function getCurrentActions(gameState, gameData) {
    const validActions = [];
    const locationData = gameData.locations[gameState.world.currentLocation]; // Location specific data
    const globalData = gameData.globalActions; // Global options

    // A combined list of all menu definitions (local and global)
    const allMenuSources = [
        ...(locationData.menu || []),
        ...(globalData.menu || [])
    ];

    // Process all static actions from both location and global files
    for (const category of allMenuSources) {
        for (const action of category.subActions) {
            // Check if the action's conditions are met by the current game state
            if (areConditionsMet(action.showIf, gameState, gameData)) {
                
                // Create the final action object and add it to the list
                validActions.push({
                    id: action.id,
                    displayText: gameData.texts[action.text_ref] || action.id, // Fallback to ID if text_ref is missing
                    effects: action.effects
                });
            }
        }
    }

    return validActions;
}

export function initializeGameState(gameData) {
    const initialState = gameData.initialState;

    // 1. Create the Player state
    const player = {
        ...initialState.player.initialStats,
        inventory: { ...initialState.player.initialInventory }
    };

    // 2. Create the World state
    const world = { ...initialState.world }; // Full copy
    world.flags = { ...initialState.world.flags }; // Deep copy flags
    world.fortifications = { ...initialState.world.fortifications }; // Deep copy fortifications
    world.traps = { ...initialState.world.traps }; // Deep copy traps
    world.visitedLocations = []; // Fresh arrays
    world.scavengedLocations = []; // Fresh arrays

    // 3. Find and set the actions for the first phase
    const firstPhaseData = gameData.phases.phases.find(p => p.id === world.currentPhaseId);
    if (!firstPhaseData) {
        console.error(chalk.red(`FATAL ERROR: Could not find phase data for initial phase ID: "${world.currentPhaseId}"`));
        process.exit(1);
    }
    world.actionsRemaining = firstPhaseData.durationInActions;

    // 4. Create Horde and Status (fresh copies)
    const horde = { ...initialState.horde };
    const status = { ...initialState.status };
    
    // 5. Assemble and return the complete gameState object
    return {
        player,
        world,
        horde,
        status
    };
}

// The main entry point for the game.
async function startGame() {
    const gameData = await loadGameData(); // Get Game Data object
    
    // ... initializeGameState() and main game loop would start here ...
    const gameState = initializeGameState(gameData);
    
    runGameLoop(gameState, gameData);
}

function tickClock(gameState) {
    gameState.world.actionsRemaining -= 1;
    if (gameState.status.gracePeriodCooldown > 0) {
        gameState.status.gracePeriodCooldown -= 1;
    }
    if (gameState.status.repeatedSpawnCooldown > 0) {
        gameState.status.repeatedSpawnCooldown -= 1;
    }
}

function checkGameStatus(gameState, gameData) {
    if (gameState.player.health <= 0) {
        endGame('lose', gameState, gameData);
    }
    if (gameState.world.actionsRemaining === 0) {
        const nextIndex = gameData.phases.phases.findIndex(phase => phase.id === gameState.world.currentPhaseId) + 1;

        gameState.world.currentPhaseId = gameData.phases.phases[nextIndex].id
        gameState.world.actionsRemaining = gameData.phases.phases[nextIndex] ? gameData.phases.phases[nextIndex].durationInActions : -1;
    }

    if (gameState.world.currentPhaseId === 'dawn') {
        endGame('win', gameState, gameData);
    }
}

function endGame(outcome, gameState, gameData) {
    prompt('Press Enter to continue to the next (mock) turn...');
    console.clear();
    const messageStrings = [];
    if (gameState.status.messageQueue && gameState.status.messageQueue.length > 0) {
        for (const messageObject of gameState.status.messageQueue) {
            const template = gameData.texts[messageObject.text_ref];
            if (template) {
                const renderedMessage = renderText(template, messageObject.params);
                messageStrings.push(renderedMessage);
            }
        }
    }
    const consequenceAndThreatText = messageStrings.join('\n')
    const finalMessages = [];
    if (outcome === 'lose') {
        finalMessages.push(gameData.texts.game_over_lose);
    } else if (outcome === 'win') {
        finalMessages.push(gameData.texts.phase_intro_dawn);

        const totalMonsters = Object.values(gameState.horde).reduce((sum, list) => sum + list.length, 0);
        if (totalMonsters > 0) {
            finalMessages.push(gameData.texts.game_over_win_monsters);
        }
        if (gameState.player.health <= 15) {
            finalMessages.push(gameData.texts.game_over_win_critical);
        } else {
            finalMessages.push(gameData.texts.game_over_win_normal);
        }
    }
    const endMessage = finalMessages.join(" ");

    console.log(consequenceAndThreatText + "\n\n" + chalk.magenta.italic(endMessage));
    process.exit(0);
}

// TODO Game loop
async function runGameLoop(gameState, gameData) {
    while (true) {
        
        // ---- START OF TURN FUNCTIONS ----
        processTimedEvents(gameState,gameData);
        processNoiseSpawning(gameState, gameData);
        processNoiseDespawning(gameState, gameData);
        trapMonster(gameState, gameData);
        processFortificationDamage(gameState,gameData);

        // 1. Build the prompt text
        const promptText = buildPromptText(gameState, gameData);

        // 2. Get the valid action list
        const validActions = getCurrentActions(gameState, gameData);

        // 3. Call the UI function to display everything and get input
        // It takes the text, the actions, and the prompt function as arguments.
        const chosenAction = updateConsoleUI(promptText, validActions, prompt, gameState);
        // 'chosenAction' is now the object the player selected, e.g., { id: "move_to_graveyard", ... }

        // 4. Process the player's choice
        console.log(chalk.yellow(`\nYou chose: ${chosenAction.id}`));

        gameState.world.previousLocation = gameState.world.currentLocation;

        handleEffects(chosenAction, gameState, gameData);
        processPlayerDamage(gameState, gameData);
        tickClock(gameState);
        checkGameStatus(gameState, gameData);
        
        // For now, let's just pause to see the result.
        prompt('Press Enter to continue to the next (mock) turn...');
    }
}

// Run the game.
startGame();