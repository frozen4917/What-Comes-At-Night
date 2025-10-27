import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });

import { getRandomInt } from "./utils.js";

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
                        messageParams[stat] = gameState.player[stat] - currentValue;
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
                    const currentValue = gameState.player.stamina;
                    gameState.player.stamina = Math.min(100, gameState.player.stamina + stamGain);
                    const netGain = gameState.player.stamina - currentValue;
                    gameState.status.messageQueue.push({ 
                        text_ref: "outcome_wait_normal",
                        params: (netGain > 0) ? { staminaRegen: ` You regain ${netGain} stamina.` } : { staminaRegen: "" } 
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

export function processCraftEffect(effects, gameState, gameData) {
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

export function updateHidingStatus(chosenAction, gameState) {
    if (gameState.status.playerState === "hiding") {
        // Actions that DON'T break hiding
        const isStayingHidden = [
            "hide_in_tents", 
            "hide_in_cabin", 
            "hide_in_hut",
            "wait"
        ].includes(chosenAction.id);
        
        if (!isStayingHidden) {
            // Player did a real action, i.e. no longer hidden
            gameState.status.playerState = "normal";
            
            gameState.status.messageQueue.push({ 
                text_ref: "outcome_stop_hiding" 
            });
        }
    }
}