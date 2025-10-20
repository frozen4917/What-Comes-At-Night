import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });

import { loadGameData } from './loader.js';
import { updateConsoleUI } from './ui.js';
import { getRandomInt, areConditionsMet } from './utils.js';

export function buildPromptText(gameState, gameData) {
    const { world, status } = gameState; // Deconstruct gameState
    const { texts } = gameData;

    const timelineKey = `${world.currentPhaseId}_flavor_${world.actionsRemaining}`; // Timeline flavor text: Build key, e.g. dusk_flavor_4
    const timelineText = texts[timelineKey] || `The night continues...`; // Actual text from texts.json

    // Location description
    let locationDescription = '';
    const locationKeyBase = `loc_desc_${world.currentLocation}`;    // Location base e.g. loc_desc_campsite
    
    if (!world.visitedLocations.includes(world.currentLocation)) {
        // First-time visit
        locationDescription = texts[locationKeyBase + '_first'];    // Location text on first visit e.g. loc_desc_campsite_first
        world.visitedLocations.push(world.currentLocation);         // Mark as visited
    } else if (world.currentLocation === world.previousLocation) {
        // Player is still in the same location
        const locationArrayBase = locationKeyBase + '_current';     // Array base of the location e.g. loc_desc_cabin_current[]
        locationDescription = texts[locationArrayBase][getRandomInt(0,texts[locationArrayBase].length - 1)]     // Randomly select from array
    } else {
        // Player has returned to a previously visited location
        const locationArrayBase = locationKeyBase + '_return';      // Array base of the location e.g. loc_desc_cabin_return
        locationDescription = texts[locationArrayBase][getRandomInt(0,texts[locationArrayBase].length - 1)]     // Randomly select from array
    }

    // Get the status/consequence of prev. turn message (placeholder) -- TODO
    const statusMessage = status.message;
    status.message = ""; // Clear the message after retrieving it

    // Get threat text -- TODO
    const threatText = ""; // TODO

    // Assemble all parts into a final string
    const parts = [timelineText, locationDescription, statusMessage, threatText];
    return parts.filter(part => part).join('\n\n'); // Filter out empty parts and join
}

// WIP - NEW
export function getCurrentActions(gameState, gameData) {
    const validActions = [];
    const locationData = gameData.locations[gameState.world.currentLocation]; // Location specific data
    const globalData = gameData.globalActions; // Global options

    // A combined list of all menu definitions (local and global)
    const allMenuSources = [
        ...(locationData.menu || []),
        ...(globalData.menu || [])
    ];

    // 1. Process all static actions from both location and global files
    for (const category of allMenuSources) {
        for (const action of category.subActions) {
            // Check if the action's conditions are met by the current game state
            if (areConditionsMet(action.showIf, gameState, gameData)) {
                
                // Create the final action object and add it to our list
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

export function handleEffects(effects, gameState, gameData) {
    if (!effects) return "You wait a moment, gathering your thoughts";

    let resultRef = effects.result_ref;

    for (const key in effects) {
        const value = effects[key];
        switch (key) {
            case "setLocation":
                // gameState.world.previousLocation = gameState.world.currentLocation;
                gameState.world.currentLocation = value;
                break;
            
            case "changeStat":
                for (const stat in value) {
                    if (gameState.player[stat] !== undefined) {
                        gameState.player[stat] += value[stat];
                    } else if (gameState.world.fortifications[stat] !== undefined) {
                        gameState.world.fortifications[stat] += value[stat];
                        outcomeData.fortificationName = stat;
                    }
                }
                break;
            
            case "addItems":
                for (const itemID in value) {
                    const quantity = value[itemID];
                    gameState.player.inventory[itemID] = (gameState.player.inventory[itemID] || 0) + quantity;
                }
                break;
            
            case "addRandomItems":
                for (const itemID in value) {
                    const { min, max } = value[itemID];
                    const quantity = getRandomInt(min, max);
                    if (quantity > 0) {
                        gameState.player.inventory[itemID] = (gameState.player.inventory[itemID] || 0) + quantity;
                    }
                }
                break;
            
            case "removeItem":
                if (gameState.player.inventory[value] && gameState.player.inventory[value] > 0) {
                    gameState.player.inventory[value]--;
                    if (gameState.player.inventory[value] <= 0) {
                        delete gameState.player.inventory[value];
                    }
                }
                break;
            
            case "removeItems": // CRAFTING
                for (const itemID in value) {
                    gameState.player.inventory[itemID] -= value[itemID];
                    if (gameState.player.inventory[itemID] <= 0) {
                        delete gameState.player.inventory[itemID];
                    }
                }
                break;
            
            case "setToFalse":
                gameState.world.flags[value] = false;
            
            case "addScavengedFlag":
                if (!gameState.world.scavengedLocations.includes(value)) {
                    gameState.world.scavengedLocations.push(value);
                }
                break;
            
            case "craft": 
                processCraftEffect(value, gameState, gameData);
                break;
            
            case "attackType":
            case "attackTarget":
            case "attackBoss":
                // All attack effects are handled by one helper
                // processAttackEffect(effects, gameState, gameData);
                break;

        }
    }
}

function processCraftEffect(itemID, gameState, gameData) {
    const craftableItem = gameData.items[itemID];

    // Safety check: if the item or its recipe doesn't exist, do nothing.
    if (!craftableItem || !craftableItem.recipe) {
        console.error(chalk.red(`Attempted to craft an item with no recipe: ${itemID}`));
        return;
    }

    // Remove ingredients from the player's inventory
    for (const ingredient of craftableItem.recipe) {
        const ingredientID = ingredient.item;
        const quantityNeeded = ingredient.quantity;

        if (gameState.player.inventory[ingredientID]) {
            gameState.player.inventory[ingredientID] -= quantityNeeded;
            // If the ingredient count drops to zero, remove it from the inventory
            if (gameState.player.inventory[ingredientID] <= 0) {
                delete gameState.player.inventory[ingredientID];
            }
        }
    }

    // Add the newly crafted item to the inventory
    gameState.player.inventory[itemID] = (gameState.player.inventory[itemID] || 0) + 1;
    console.log(chalk.green(`Crafted ${itemID}`));
    // Return the name of the item for the result message
    // return { itemName: craftableItem.name };
}

export function initializeGameState(gameData) {
    const initialState = gameData.initialState;

    const player = {
        ...initialState.playerConfig.initialStats, // Spreads { health: 100, stamina: 100 }
        inventory: { ...initialState.playerConfig.initialInventory } // Creates a fresh copy
    };

    // 2. Create the World state
    const firstPhaseId = initialState.initialGameState.currentPhaseId;

    // Find the full data for the first phase to get its duration
    const firstPhaseData = gameData.phases.phases.find(p => p.id === firstPhaseId);
    if (!firstPhaseData) {
        // This is a critical error, the game can't start if the phase data is missing.
        console.error(chalk.red(`FATAL ERROR: Could not find phase data for initial phase ID: "${firstPhaseId}"`));
        process.exit(1);
    }
    
    const world = {
        ...initialState.initialGameState, // Spreads initial fortifications, noise, location, and flags
        actionsRemaining: firstPhaseData.durationInActions,
        visitedLocations: [],
        scavengedLocations: [],
        traps: {
            campGate: 0,
            graveyardGate: 0
        },
        hordeLocation: "" // Empty = No Horde
    };

    // 3. Empty Horde
    const horde = {
        spirit: [],
        zombie: [],
        skeleton: [],
        witch: [],
        vampire: []
    };

    // 4. Create the initial Status state
    const status = {
        gameMode: "exploring", // Exploring or combat
        playerState: "normal", // normal or hiding
        message: "" // Consequence of previous action
    };
    
    // 5. Assemble and return the complete gameState object
    return {
        player,
        world,
        horde,
        status
    };
}

// The main entry point for your game.
async function startGame() {
    const gameData = await loadGameData(); // Get Game Data object
    
    // ... initializeGameState() and main game loop would start here ...
    const gameState = initializeGameState(gameData);
    
    runGameLoop(gameState, gameData);
}

// TODO Game loop
// 16/10/2025 - Basic functionality: Prompt text, option list, display option chosen
async function runGameLoop(gameState, gameData) {
    while (true) {
        
        // ---- FUTURE START OF TURN FUNCTIONS ----
        // processTimedEvents()
        // processMonsterActions()

        // 1. Build the prompt text
        const promptText = buildPromptText(gameState, gameData);

        // 2. Get the valid action list
        const validActions = getCurrentActions(gameState, gameData);

        // 3. Call the UI function to display everything and get input
        // It takes the text, the actions, and the prompt function as arguments.
        const chosenAction = updateConsoleUI(promptText, validActions, prompt);
        // 'chosenAction' is now the object the player selected, e.g., { id: "move_to_graveyard", ... }

        // 4. Process the player's choice
        console.log(chalk.yellow(`\nYou chose: ${chosenAction.id}`));

        gameState.world.previousLocation = gameState.world.currentLocation;
        // ---- FUTURE FUNCTIONS ----
        handleEffects(chosenAction.effects, gameState, gameData);
        // tickClock(gameState, gameData);
        // checkGameStatus(gameState);
        
        // For now, let's just pause to see the result.
        prompt('Press Enter to continue to the next (mock) turn...');
    }
}

// Run the game.
startGame();