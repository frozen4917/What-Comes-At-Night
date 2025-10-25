import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });

import { loadGameData } from './loader.js';
import { updateConsoleUI } from './ui.js';
import { getRandomInt, areConditionsMet, renderText } from './utils.js';

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

    // CONSEQUENCE & THREAT
    // example of messageQueue object:
    // { text_ref: "threat_horde_spawn_timed", params: { hordeComposition: "..." } }
    const messageStrings = [];
    if (status.messageQueue && status.messageQueue.length > 0) {
        
        // Loop over every message object in the queue
        for (const messageObject of status.messageQueue) {
            
            // 1. Get the template string from texts.json
            const template = texts[messageObject.text_ref];
            
            if (template) {
                // 2. Use your renderText helper to build the final string
                const renderedMessage = renderText(template, messageObject.params);
                
                // 3. Add it to our list
                messageStrings.push(renderedMessage);
            } else {
                messageStrings.push(`[Missing text_ref: ${messageObject.text_ref}]`);
            }
        }
        
        // 4. ADD THIS LINE: Clear the queue for the next turn
        status.messageQueue = []; // <--- THIS IS THE FIX
    }

    const consequenceAndThreatText = messageStrings.join('\n');

    // Assemble all parts into a final string
    const parts = [timelineText, locationDescription, consequenceAndThreatText];
    return parts.filter(part => part).join('\n\n'); // Filter out empty parts and join
}

// WIP - NEW: Fetches available actions
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

export function handleEffects(effects, gameState, gameData) {
    if (!effects) return;

    let messageParams = {};
    let specialMessageHandled = false; // This flag stops duplicate messages for special cases (attack, craft, wait).

    for (const key in effects) {
        const value = effects[key];
        switch (key) {
            case "setLocation":
                gameState.world.currentLocation = value;
                // NO MESSAGE - Handled by location text
                break;
            
            case "changeStat":
                for (const stat in value) {
                    const change = value[stat];

                    if (gameState.player[stat] !== undefined) {
                        let currentValue = gameState.player[stat];
                        gameState.player[stat] = Math.max(0, Math.min(100, currentValue + change));
                        
                        // For texts like: "gain {health} HP" or "gain {stamina} stamina"
                        messageParams[stat] = change;
                    } else if (gameState.world.fortifications[stat] !== undefined) {
                        let currentFHP = gameState.world.fortifications[stat];
                        let newFHP = currentFHP + change;
                        gameState.world.fortifications[stat] = newFHP;
                        
                        // For texts like: "strength is now at {strength}"
                        messageParams.strength = newFHP;
                    } else if (gameState.world[stat] !== undefined) {
                        let currentNoise = gameState.world.noise;
                        gameState.world.noise = Math.max(0, currentNoise + change);
                        
                        // For texts like: "reduces noise by {noiseChange}"
                        messageParams.noise = change;
                    }
                }
                break;
            
            case "addItems":
                for (const itemID in value) {
                    const quantity = value[itemID];
                    gameState.player.inventory[itemID] = (gameState.player.inventory[itemID] || 0) + quantity;
                }
                // Text in text_ref below. No dynamic params
                break;
            
            case "addRandomItems":
                // for woods
                let added = {}
                for (const itemID in value) {
                    const { min, max } = value[itemID];
                    const quantity = getRandomInt(min, max);
                    if (quantity > 0) {
                        gameState.player.inventory[itemID] = (gameState.player.inventory[itemID] || 0) + quantity;
                        added[itemID] = quantity;
                    }
                }
                messageParams.quantity = added['wood'] || 0;
                break;
            
            case "removeItem":
                if (gameState.player.inventory[value] && gameState.player.inventory[value] > 0) {
                    gameState.player.inventory[value]--;
                    if (gameState.player.inventory[value] <= 0) {
                        delete gameState.player.inventory[value];
                    }
                }
                // NO MESSAGE
                break;
            
            case "setPlayerState":
                // The result_ref (e.g., "outcome_hide_in_tents")will be pushed at the end, and it doesn't need params.
                gameState.status.playerState = value;
                break;

            case "setToFalse":
                gameState.world.flags[value] = false;
                // NO MESSAGE
                break;
            
            case "addScavengedFlag":
                if (!gameState.world.scavengedLocations.includes(value)) {
                    gameState.world.scavengedLocations.push(value);
                }
                // NO MESSAGE
                break;
            
            case "wait":
                specialMessageHandled = true; 
                if (gameState.status.playerState === "hiding") {
                    // Pushes "outcome_wait_hiding" (no params)
                    gameState.status.messageQueue.push({ text_ref: "outcome_wait_hiding" });
                } else {
                    // Pushes "outcome_wait_normal" (with stamina param)
                    const stamGain = 5;
                    gameState.player.stamina = Math.min(100, gameState.player.stamina + stamGain);
                    gameState.status.messageQueue.push({ 
                        text_ref: "outcome_wait_normal",
                        params: { stamina: stamGain } 
                    });
                }
                break;


            case "craft": 
                processCraftEffect(effects, gameState, gameData);
                specialMessageHandled = true;
                break;
            
            case "attackType":
            case "attackTarget":
            case "attackBoss":
                // All attack effects are handled by one helper
                // processAttackEffect(effects, gameState, gameData);
                specialMessageHandled = true;
                break;

            case "result_ref":
            case "weaponPriority":
                // Ignored, these are data, not effects to process.
                break;
            
            default:
                console.log(chalk.redBright(`Unhandled effect key: ${key}`));
        }
    }
    if (effects.result_ref && !specialMessageHandled) {
        gameState.status.messageQueue.push({
            text_ref: effects.result_ref,
            params: messageParams 
        });
    }
    console.log(chalk.yellowBright(`${gameState.status.messageQueue}`));
}

function processCraftEffect(effects, gameState, gameData) {
    const itemID = effects.craft;
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
    console.log(chalk.green(`Crafted ${itemID}`)); // DEBUGGING. TO REMOVE

    if (effects.result_ref) {
        gameState.status.messageQueue.push({
            text_ref: effects.result_ref,
            params: {} // No params needed for static craft texts
        });
    }
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
        messageQueue: [] // Consequence of previous action + threat + monster damages
    };
    
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
}

function checkGameStatus(gameState, gameData) {
    if (gameState.player.health <= 0) {
        //endGame('lose');
    }
    if (gameState.world.actionsRemaining === 0) {
        const nextIndex = gameData.phases.phases.findIndex(phase => phase.id === gameState.world.currentPhaseId) + 1;

        gameState.world.currentPhaseId = gameData.phases.phases[nextIndex].id
        gameState.world.actionsRemaining = gameData.phases.phases[nextIndex] ? gameData.phases.phases[nextIndex].durationInActions : -1;
    }

    if (gameState.world.currentPhaseId === 'dawn') {
        //endGame('win');
    }
}

// TODO Game loop
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
        const chosenAction = updateConsoleUI(promptText, validActions, prompt, gameState);
        // 'chosenAction' is now the object the player selected, e.g., { id: "move_to_graveyard", ... }

        // 4. Process the player's choice
        console.log(chalk.yellow(`\nYou chose: ${chosenAction.id}`));

        gameState.world.previousLocation = gameState.world.currentLocation;
        // ---- FUTURE FUNCTIONS ----
        handleEffects(chosenAction.effects, gameState, gameData);
        tickClock(gameState);
        checkGameStatus(gameState, gameData);
        
        // For now, let's just pause to see the result.
        prompt('Press Enter to continue to the next (mock) turn...');
    }
}

// Run the game.
startGame();