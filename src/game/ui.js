/**
 * @file ui.js
 * @description Text Generation & UI Helpers.
 * This file constructs the dynamic text presented to the player.
 * It handles:
 * - Building the main story prompt (Timeline + Location + Threats).
 * - Generating dynamic tooltips for actions (Costs vs. Gains).
 */

import { getRandomInt, renderText, getRandomText } from "./utils.js";

/**
 * Builds the prompt text by combining timeline flavour text, location text, consequence text, threats text, status text, and call-to-action
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 * @returns {string} Entire prompt text
 */
export function buildPromptText(gameState, gameData) {
    const { player, world, status } = gameState; // Deconstruct gameState
    const { texts, settings } = gameData;

    // --- TIMELINE TEXT ---
    // This is purely flavor text based on the current phase and actions remaining

    const timelineKey = `${world.currentPhaseId}_flavor_${world.actionsRemaining}`; // Timeline flavor text's key, e.g. dusk_flavor_4
    const timelineText = texts[timelineKey] || `The night continues...`; // Actual text from texts.json. Fallback in case of missing text


    // --- LOCATION TEXT ---
    // This gives location-related texts, such as introducing a new place, or giving texts for when you return back to an already visited place
    let locationDescription = '';
    const locationKeyBase = `loc_desc_${world.currentLocation}`; // Location base, e.g. loc_desc_campsite
    
    if (!world.visitedLocations.includes(world.currentLocation)) {
        // --- First time visit ---
        locationDescription = texts[locationKeyBase + '_first']; // Location text on first visit e.g. loc_desc_campsite_first
        world.visitedLocations.push(world.currentLocation); // Mark as visited

    } else if (world.currentLocation === world.previousLocation) {
        // --- Same location as previous turn ---
        const locationArrayBase = locationKeyBase + '_current'; // Array base of the location e.g. loc_desc_cabin_current[]
        locationDescription = texts[locationArrayBase][getRandomInt(0,texts[locationArrayBase].length - 1)]; // Randomly select from array

    } else {
        // --- Return from another location ---
        const locationArrayBase = locationKeyBase + '_return'; // Array base of the location e.g. loc_desc_cabin_return
        locationDescription = texts[locationArrayBase][getRandomInt(0,texts[locationArrayBase].length - 1)];  // Randomly select from array

    }

    // --- CONSEQUENCE & THREAT ---
    // This includes consequence of previous actions like crafting, attacking, fortifying, etc. and threat messages like horde spawning, attacks, lone monster spawning/despawning, etc.

    // Messages are fetched from message queue, rendered to replace placeholders, and then added to an array, which is then converted into the text
    // Example of object in messageQueue: { text_ref: "threat_horde_spawn_timed", params: { hordeComposition: "..." } }
    const messageStrings = [];
    if (status.messageQueue && status.messageQueue.length > 0) {

        // Loop over every message object in the queue
        for (const messageObject of status.messageQueue) {
            
            // 1. Get the template string from texts.json
            const template = getRandomText(messageObject.text_ref, gameData);
            if (template) {
                // 2. Use renderText to build the final string
                const renderedMessage = renderText(template, messageObject.params);
                
                // 3. Add it to our list
                messageStrings.push(renderedMessage);
            } else {
                console.error(`Missing text_ref: ${messageObject.text_ref}`);
            }
        }
        
        // 4. Clear array
        status.messageQueue = [];
    }

    const consequenceAndThreatText = messageStrings.join('\n');


    // --- STATUS MESSAGE ---
    // Gives warnings for low health or stamina

    const statusMessages = [];
    
    // Health Warnings
    if (player.health <= settings.STATUS_WARNINGS.CRITICAL) {
        statusMessages.push(texts.status_health_critical);
    } else if (player.health <= settings.STATUS_WARNINGS.LOW) {
        statusMessages.push(texts.status_health_low);
    }

    // Stamina Warnings
    if (player.stamina <= settings.STATUS_WARNINGS.CRITICAL) {
        statusMessages.push(texts.status_stamina_critical);
    } else if (player.stamina <= settings.STATUS_WARNINGS.LOW) {
        statusMessages.push(texts.status_stamina_low);
    }
    
    // Join all status messages
    const statusText = statusMessages.join('\n');

    // Assemble all parts into a final string
    const parts = [timelineText, locationDescription, consequenceAndThreatText, statusText];
    return parts.filter(part => part).join('\n\n'); // Filter out empty parts and join
}

/**
 * Generates an array of strings for the action tooltip.
 * @param {object} action Action object from validActions
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 * @returns {string[]} An array of formatted info lines.
 */
export function generateTooltipText(action, gameState, gameData) {
    const { effects } = action;

    if (!effects || !gameData) return ["No info available."]; // No data, use default text and return

    let costs = [], damage = [], stats = []; // Arrays to contain the infortmation

    // Loop through all keys in the effect object
    for (const key in effects) {
        const value = effects[key]; // Get value of an effect change
        switch (key) {
            
            case "wait": // Wait / "Do Nothing" action
                if (gameState.status.playerState === "hiding" && gameState.status.gameMode === "combat_lone") {
                    // Waiting while hiding. Involves only active Noise Reduction
                    stats.push(`-${value.hidingNoiseReduction} Noise`);
                } else {
                    // Waiting without hiding. Involves passive Noise reduction and a small stamina gain
                    stats.push(`+${value.staminaGain} Stamina`);
                    stats.push(`-${value.noiseReduction} Noise`);
                }
                break;

            case "changeStat": // Stats like Stamina, Noise, Fortification, and Health being updated
                for (const stat in value) {
                    const change = value[stat];
                    if (stat === 'stamina' && change < 0) { // Stamina cost. Pushed into 'costs' array
                        costs.push(`${Math.abs(change)} Stamina`);
                    }
                    if (stat === 'noise' && change !== 0) { // Noise change
                        const sign = change > 0 ? '+' : ''; // If change is > 0, add a '+' sign. Else, the value already has a '-' sign.
                        stats.push(`${sign}${change} Noise`);
                    }
                    if (stat === 'health' && change > 0) { // Health increase
                        stats.push(`+${change} HP`);
                    }
                    if (stat === 'stamina' && change > 0) { // Stamina increase. Pushed into 'stats' array
                        stats.push(`+${change} Stamina`);
                    }
                    if (gameData.initialState.world.fortifications[stat] !== undefined && change > 0) { // Fortification increase
                        stats.push(`+${change} Fortification HP`);
                    }
                }
                break;

            case "removeItem": // Removal of item
                costs.push(`1 ${gameData.items[value].name}`);
                break;
                
            case "craft": // Crafting of items
                const recipe = gameData.items[value]?.recipe;
                if (recipe) {
                    recipe.forEach(ingredient => {
                        costs.push(`${ingredient.quantity} ${gameData.items[ingredient.item].name}`); // Add all ingredients into the 'costs' array
                    });
                }
                break;

            case "addTrap": // Special case for adding traps
                costs.push(`1 ${gameData.items["wood"].name}`);
                costs.push(`1 ${gameData.items["net"].name}`);
                break;

            case "attackType": // Attack related info
                let weapon = null;
                if (effects.weaponPriority) {
                    for (const id of effects.weaponPriority) {
                    // Find if the weapon exists in the inventory. If it does, break out from the loop. Better weapon will be used. (axe > baseball bat)
                    if (gameState.player.inventory[id] > 0) {
                        weapon = gameData.items[id];
                        break;
                    }
                }
                }

                switch (effects.attackType) {
                    case "single": // Regular single attack
                        damage.push(`Damage: ${weapon.effects.single_attack.damage} (1 Target)`);
                        break;

                    case "cleave": // Cleave attack using an axe, targeting multiple monsters.
                        const minTargetCount = weapon.effects.cleave_attack.targets.min;
                        const maxTargetCount = weapon.effects.cleave_attack.targets.max;
                        let targetCount = '';
                        // Format targetCount based on if min and max value match or not
                        if (minTargetCount == maxTargetCount) {
                            targetCount = maxTargetCount; // e.g. targetCount = 4
                        } else {
                            targetCount = `${minTargetCount}-${maxTargetCount}` // e.g. targetCount = '3-4'
                        }
                        damage.push(`Damage: ${weapon.effects.cleave_attack.damage} (${targetCount} Targets)`);
                        break;

                    case "shoot": // Shooting an arrow using a bow
                        costs.push(`1 Arrow`);
                        damage.push(`Damage: ${gameData.items.bow.effects.single_attack.damage} (1 Target)`);
                        break;

                    case "incinerate": // Using Molotov to incinerate the horde
                        costs.push(`1 Molotov`);
                        damage.push(`Damage: ${gameData.items.molotov.effects.incinerate.damage} (All Targets)`);
                        break;

                    case "special": // Special attack against boss usingg specific items
                        const item = gameData.items[effects.removeItem]; // Object of that item from items.json
                        costs.push(`1 ${item.name}`);
                        damage.push(`Damage: ${item.effects.damage} (Boss)`);
                        break;
                }
                break;
            
            // Default: Ignore keys that don't have tooltips
            default:
                break;
        }
    }

    // -Assemble the final lines
    const lines = [];
    if (costs.length > 0) lines.push(`Costs: ${costs.join(', ')}`);
    if (stats.length > 0) lines.push(`Stats: ${stats.join(', ')}`);
    if (damage.length > 0) lines.push(damage.join(', '));

    if (lines.length === 0) {
        return ["No significant cost or effect."];
    }
    
    return lines;
};