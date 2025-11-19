/**
 * @file effectsHandler.js
 * @description Action Consequence Processor.
 * This file interprets the effects object from globalActions.json and locations.json.
 * It is responsible for:
 * - Modifying stats (Health, Stamina, Noise).
 * - Managing inventory (Adding/Removing/Crafting items).
 * - Executing combat logic (Attacks, Weapon effects).
 */

import { getRandomInt, checkAndSetGracePeriod } from "./utils.js";

/**
 * Implements all effects in the chosen action's effects object
 * @param {Object} chosenAction Action object chosen by the player from the validActions array
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function handleEffects(chosenAction, gameState, gameData) {
    updateHidingStatus(chosenAction, gameState); // Updates hiding status to normal if action is non-hiding action

    const effects = chosenAction.effects;
    if (!effects) return; // Early exit if not effects

    let messageParams = {}; // Params for messageQueue entry
    let specialMessageHandled = false; // This flag stops duplicate messages for special cases (attack, craft, wait)

    // Loop through all keys in the effect object
    for (const key in effects) {
        const value = effects[key]; // Get value of an effect change
        switch (key) {
            case "setLocation": // Movement
                gameState.world.currentLocation = value;
                // NO MESSAGE - Handled by location text
                break;
            
            case "changeStat": // Change player stats, noise, fortification
                let staminaGainText = "";
                let healthGainText = "";

                for (const stat in value) {
                    const change = value[stat];

                    if (gameState.player[stat] !== undefined) {
                        // --- Player stats update ---
                        let currentValue = gameState.player[stat];
                        gameState.player[stat] = Math.max(0, Math.min(100, currentValue + change));
                        let actualChange = gameState.player[stat] - currentValue; // Change in player's stat from initial to final

                        if (stat === 'health' && actualChange > 0) {
                            // Health increase > 0
                            healthGainText = ` You regain ${actualChange} HP.`;
                        }
                        if (stat === 'stamina' && actualChange > 0) {
                            // Stamina increase > 0
                            staminaGainText = ` You regain ${actualChange} stamina.`;
                        }

                        messageParams.healthGain = healthGainText;
                        messageParams.staminaGain = staminaGainText;
                    } else if (gameState.world.fortifications[stat] !== undefined) {
                        // --- Fortification update ---
                        let currentFHP = gameState.world.fortifications[stat];
                        let newFHP = Math.max(0, currentFHP + change);
                        gameState.world.fortifications[stat] = newFHP;
                        
                        messageParams.strength = newFHP; // For texts like: "strength is now at {strength}"

                    } else if (gameState.world[stat] !== undefined) {
                        // --- Noise update ---
                        let currentNoise = gameState.world.noise;
                        gameState.world.noise = Math.max(0, currentNoise + change);
                        
                        messageParams.noise = change; // For texts like: "reduces noise by {noise}"
                    }
                }
                break;
            
            case "addItems": // Add all items into the player inventory
                for (const itemID in value) {
                    const quantity = value[itemID];
                    gameState.player.inventory[itemID] = (gameState.player.inventory[itemID] || 0) + quantity;
                }
                // No placeholders
                break;
            
            case "addRandomItems": // For adding random items, here... random amount of wood
                let added = {}
                for (const itemID in value) {
                    const { min, max } = value[itemID];
                    const quantity = getRandomInt(min, max);
                    if (quantity > 0) {
                        gameState.player.inventory[itemID] = (gameState.player.inventory[itemID] || 0) + quantity;
                        added[itemID] = quantity;
                    }
                }

                messageParams.quantity = added['wood'] || 0; // For texts like: "you gather {quantity} wood."
                break;
            
            case "removeItem": // Remove item from player's inventory
                if (gameState.player.inventory[value] && gameState.player.inventory[value] > 0) {
                    gameState.player.inventory[value]--;
                    if (gameState.player.inventory[value] <= 0) { // If item value is <= 0, delete to avoid clutter
                        delete gameState.player.inventory[value];
                    }
                }
                // NO MESSAGE
                break;
            
            case "setPlayerState": // Sets player state to "hiding" or "normal"
                gameState.status.playerState = value;
                // No placeholders
                break;

            case "setToFalse": // Sets flags to false
                gameState.world.flags[value] = false;
                // NO MESSAGE
                break;
            
            case "addScavengedFlag": // Once a location is visited, it is pushed in scavengedLocations array. areConditionsMet() function filters those locations out
                if (!gameState.world.scavengedLocations.includes(value)) {
                    gameState.world.scavengedLocations.push(value);
                }
                // NO MESSAGE
                break;
            
            case "addTrap": // Adds a trap at campGate or graveyardGate
                gameState.world.traps[value] +=  1; // Increment trap counter for that location
                gameState.player.inventory.wood -= 1; // Remove materials
                gameState.player.inventory.net -= 1; // Remove materials
                if (gameState.player.inventory.wood <= 0) {
                    delete gameState.player.inventory.wood; // Delete the item if quantity reaches 0
                }
                if (gameState.player.inventory.net <= 0) {
                    delete gameState.player.inventory.net; // Delete the item if quantity reaches 0
                }
                break;
            
            case "wait": // Handles the "do nothing" option, always available
                specialMessageHandled = true; // Special message is handled here itself. Avoids duplicate message after the 'switch' statement

                if (gameState.status.playerState === "hiding" && gameState.status.gameMode === "combat_lone") {
                    // --- Player is hiding and lone monsters are present ---
                    const noiseReduction = value.hidingNoiseReduction; // Active Noise reduction
                    let currentNoise = gameState.world.noise;
                    gameState.world.noise = Math.max(0, currentNoise - noiseReduction);

                    gameState.status.messageQueue.push({ text_ref: "outcome_wait_hiding" }); // Pushes unique message
                } else {
                    // --- Player is not hiding (Stamina gain condition) ---
                    const stamGain = value.staminaGain; // Add bonus stamina
                    const noiseReduction = value.noiseReduction; // Passive Noise reduction
                    const currentStaminaValue = gameState.player.stamina;
                    gameState.player.stamina = Math.min(100, gameState.player.stamina + stamGain);
                    const netStaminaGain = gameState.player.stamina - currentStaminaValue;

                    gameState.world.noise = Math.max(0, gameState.world.noise - noiseReduction);

                    // Pushes unique message
                    gameState.status.messageQueue.push({ 
                        text_ref: "outcome_wait_normal",
                        params: (netStaminaGain > 0) ? { staminaRegen: ` You regain ${netStaminaGain} stamina.` } : { staminaRegen: "" } 
                    });
                }
                break;


            case "craft": // Crafts an item
                processCraftEffect(effects, gameState, gameData);
                specialMessageHandled = true; // Special message is handled in the function. Avoids duplicate message after the 'switch' statement
                break;
            
            case "attackType": // All attack effects are handled by one helper
                processAttackEffect(effects, gameState, gameData); 
                gameState.world.flags.enfeebled = false; // Remove the curse after an attack
                specialMessageHandled = true; // Special message is handled in the function. Avoids duplicate message after the 'switch' statement
                break;

            case "attackBoss":
            case "attackTarget":
            case "result_ref":
            case "weaponPriority":
                // Ignored, these are data, not effects to process.
                break;
            
            default: // Any other condition, provide warning.
                console.error(`Unhandled effect key: ${key}`);
        }
    }

    // If the effects object has a dedicated "result_ref" and its wasn't already handled earlier, then we use the "result_ref" to push the next message
    if (effects.result_ref && !specialMessageHandled) {
        gameState.status.messageQueue.push({
            text_ref: effects.result_ref,
            params: messageParams 
        });
    }
}

/**
 * Crafts an item, removes the ingredients, and pushes a custom message
 * @param {Object} chosenAction Action object chosen by the player from the validActions array
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function processCraftEffect(effects, gameState, gameData) {
    const itemID = effects.craft; // item to craft
    const craftableItem = gameData.items[itemID]; // Item's object from items.json

    // Safety check: if the item or its recipe doesn't exist, do nothing.
    if (!craftableItem || !craftableItem.recipe) {
        console.error(`Attempted to craft an item with no recipe: ${itemID}`);
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

    if (effects.result_ref) {
        gameState.status.messageQueue.push({
            text_ref: effects.result_ref,
            params: {} // No params needed for static craft texts
        });
    }
}

/**
 * Process attack based on 'attackType' property
 * @param {Object} chosenAction Action object chosen by the player from the validActions array
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function processAttackEffect(effects, gameState, gameData) {
    let weaponID = null;
    // If weapon priority exists
    if (effects.weaponPriority) {
        for (const id of effects.weaponPriority) {
            // Find if the weapon exists in the inventory. If it does, break out from the loop. Better weapon will be used. (axe > baseball bat)
            if (gameState.player.inventory[id] > 0) {
                weaponID = id;
                break;
            }
        }
    }

    // Call attack functions based on attack type
    switch (effects.attackType) {
        case "cleave": // Cleave attack, targets multiple monsters
            return processCleaveAttack(effects, weaponID, gameState, gameData);
        
        case "shoot": // Uses bow-and-arrow to shoot
            return processShootAttack(effects, gameState, gameData);
        
        case "incinerate": // Uses molotov to cause a fire
            return processIncinerateAttack(effects, gameState, gameData);
        
        case "single": // Normal single-attack
            return processSingleAttack(effects, weaponID, gameState, gameData);
        
        case "special": // Special attack against boss using special items
            return processSpecialAttack(effects, gameState, gameData);
    }
}

/**
 * Performs single attack at a monster using a melee weapon
 * @param {Object} effects Effects of the action that need to be handled
 * @param {string} weaponID Weapon with highest priority, present in the player inventory
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
function processSingleAttack(effects, weaponID, gameState, gameData) {
    if (!weaponID) return;

    const weaponData = gameData.items[weaponID]; // Weapon's data from items.json 
    const baseDamage = weaponData.effects.single_attack.damage;
    const enfeebled = gameState.world.flags.enfeebled;
    // Damage = Base Damage + small randomiser. If enfeebled, the damage is only 3/4th of the actual value.
    const damage = Math.floor((baseDamage + getRandomInt(-2, 2)) * (enfeebled ? gameData.settings.PLAYER.ENFEEBLE_MULTIPLIER : 1));
    const target = effects.attackTarget; // Fetch the target
    const hordeList = gameState.horde[target];

    if (hordeList && hordeList.length > 0) {
        const randomIndex = getRandomInt(0, hordeList.length - 1); // Chooses a random monster from the target list, e.g. from zombie's array
        const monster = hordeList[randomIndex]; // Get the randomly chosen monster's instance
        monster.currentHealth -= damage; // Damage the monster

        let killParam = '', cursedParam = '';
        if (enfeebled) {
            cursedParam = " Your enfeebled swing lacks force."; // If enfeebled, add feedback text
        }
        if (monster.currentHealth <= 0) {
            // The chosen monster died
            hordeList.splice(randomIndex, 1); // Remove the defeated monster
            
            killParam = ` You killed the ${gameData.monsters[target].name}.`; // Add feedback
            checkAndSetGracePeriod(gameState, gameData); // Check if it was the last monster in the horde. If so, set cooldowns and change game mode
        }

        // Push the final text
        gameState.status.messageQueue.push({
            text_ref: effects.result_ref,
            params: {
                weapon: weaponData.name,
                damage: damage,
                kill: killParam,
                cursed: cursedParam
            }
        });
    }
}

/**
 * Performs a cleave attack on the horde, dealing damage to multiple enemies
 * @param {Object} effects Effects of the action that need to be handled
 * @param {string} weaponID Weapon with highest priority, present in the player inventory
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
function processCleaveAttack(effects, weaponID, gameState, gameData) {
    if (weaponID !== 'axe') return; // Only axe can perform cleave attack. Exit early if not an axe

    const weaponData = gameData.items[weaponID]; // Weapon's data from items.json
    const baseDamage = weaponData.effects.cleave_attack.damage;
    const targetLimits = weaponData.effects.cleave_attack.targets; // E.g. { "min": 3, "max": 4 }
    const maxSwingTargets = getRandomInt(targetLimits.min, targetLimits.max); // Maximum number of monsters that can be attacked at once ON THIS TURN, chosen between min and max values of the weapon
    const enfeebled = gameState.world.flags.enfeebled;

    let allMonsters = Object.values(gameState.horde).flat(); // Get an array of all monsters
    allMonsters.sort(() => 0.5 - Math.random()); // Randomise the array

    let targetsHit = allMonsters.slice(0, maxSwingTargets); // Selects targets based on maxSwingTargets
    let defeatedCount = 0;
    let totalDamage = 0;

    // Attack each target
    targetsHit.forEach(monster => {
        // Damage = Base Damage + small randomiser. If enfeebled, the damage is only 3/4th of the actual value. 
        let damage = Math.floor((baseDamage + getRandomInt(-1, 2)) * (enfeebled ? gameData.settings.PLAYER.ENFEEBLE_MULTIPLIER : 1));
        monster.currentHealth -= damage;
        totalDamage += damage;
        if (monster.currentHealth <= 0) {
            defeatedCount++;
        }
    });

    // Remove defeated monsters
    for (const type in gameState.horde) {
        gameState.horde[type] = gameState.horde[type].filter(m => m.currentHealth > 0);
    }

    let killParam = '', cursedParam = '';
    if (defeatedCount > 0) {
        killParam = ` You manage to kill ${defeatedCount} monster${(defeatedCount > 1) ? "s" : ""}.`; // Add feedback if player defeates atleast one monster
        checkAndSetGracePeriod(gameState, gameData); // Check if the horde is empty now. If so, set cooldowns and change game mode
    }
    if (enfeebled) {
        cursedParam = " Your heavy arms struggle to follow through with the sweeping attack." // If enfeebled, add feedback text
    }

    // Push the final text
    gameState.status.messageQueue.push({
        text_ref: effects.result_ref,
        params: {
            numHit: targetsHit.length,
            damage: totalDamage,
            kill: killParam,
            cursed: cursedParam
        }
    });
}

/**
 * Performs a shoot attack using a bow-and-arrow
 * @param {Object} effects Effects of the action that need to be handled
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
function processShootAttack(effects, gameState, gameData) {
    // Safety clause in case player doesn't have arrows. Shouldn't be executed as areConditionsMet() should handle it
    if (gameState.player.inventory.arrow <= 0) {
        console.error("ERROR: Attempted to shoot without arrow (processAttackEffect())");
        return;
    }

    gameState.player.inventory.arrow--; // Consume an arrow
    if (gameState.player.inventory.arrow <= 0) {
        delete gameState.player.inventory.arrow; // Remove arrow is quantity reaches 0
    }
    const weaponData = gameData.items.bow; // Data from items.json
    const enfeebled = gameState.world.flags.enfeebled;

    // Damage = Base Damage + small randomiser. If enfeebled, the damage is only 3/4th of the actual value. 
    const damage = Math.floor((weaponData.effects.single_attack.damage + getRandomInt(-1, 1)) * (enfeebled ? gameData.settings.PLAYER.ENFEEBLE_MULTIPLIER : 1));
    const targetOrder = ["witch", "vampire", "zombie", "skeleton", "spirit"]; // Pre-defined target order. It will target the monster with higher priority (lower index)
    let targetMonster = null;
    let targetName = null;
    let targetList = null;
    let randomIndex = -1;

    for (const type of targetOrder) {
        // Check if a monster of that type exists. If not, go to the next in the list
        if (gameState.horde[type] && gameState.horde[type].length > 0) {
            // --- Monster of the type exists ---
            targetList = gameState.horde[type];
            randomIndex = getRandomInt(0, targetList.length - 1); // Choose a random monster of that type
            targetMonster = targetList[randomIndex];
            targetName = gameData.monsters[type].name;
            break;
        }
    }

    targetMonster.currentHealth -= damage; // Damage the targetted monster

    let killParam = '', cursedParam = '';
    if (targetMonster.currentHealth <= 0) {
        targetList.splice(randomIndex, 1); // Remove the defeated monster
        killParam = ` You shot the ${targetName} to death.`; // Add feedback
        checkAndSetGracePeriod(gameState, gameData); // Check if the horde is empty now. If so, set cooldowns and change game mode
    }
    if (enfeebled) {
        cursedParam = " Your tired arms struggle to draw the bowstring." // If enfeebled, add feedback text
    }

    // Push the final text
    gameState.status.messageQueue.push({
        text_ref: effects.result_ref,
        params: {
            monster: targetName,
            damage: damage,
            kill: killParam,
            cursed: cursedParam
        }
    });

}

/**
 * Performs an incinerate attack by throwing a molotov
 * @param {Object} effects Effects of the action that need to be handled
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
function processIncinerateAttack(effects, gameState, gameData) {
    // Safety clause in case player doesn't have arrows. Shouldn't be executed as areConditionsMet() should handle it
    if (gameState.player.inventory.molotov <= 0) {
        console.error("ERROR: Attempted to incinerate without molotov (processIncinerateAttack())");
        return;
    }

    gameState.player.inventory.molotov--; // Consume the molotov
    if (gameState.player.inventory.molotov <= 0) {
        delete gameState.player.inventory.molotov; // Remove the key if 0 molotovs remain
    }
    const weaponData = gameData.items.molotov;
    const baseDamage = weaponData.effects.incinerate.damage; // Base damage of the molotov from items.json
    const enfeebled = gameState.world.flags.enfeebled;
    let allMonsters = Object.values(gameState.horde).flat(); // Fetch all monsters
    
    let defeatedCount = 0;
    let totalDamage = 0;
    
    allMonsters.forEach(monster => {
        // Damage each monster separately
        // Damage = Base damage + randomiser. If enfeebled, the damage is only 3/4th of the actual value.
        let damage = Math.floor((baseDamage + getRandomInt(-4, 3)) * (enfeebled ? gameData.settings.PLAYER.ENFEEBLE_MULTIPLIER : 1));
        monster.currentHealth -= baseDamage;
        totalDamage += damage;
        if (monster.currentHealth <= 0) {
            defeatedCount++;
        }
    });

    // Remove all defeated monsters
    for (const type in gameState.horde) {
        gameState.horde[type] = gameState.horde[type].filter(m => m.currentHealth > 0);
    } 

    let killParam = '', cursedParam = '';
    if (enfeebled) {
        cursedParam = " Your throw, weakened by the curse, doesn't achieve its full potential." // If enfeebled, add feedback text
    }
    if (defeatedCount > 0) {
        killParam = ` The fire ends up killing ${defeatedCount} monster${(defeatedCount > 1) ? "s" : ""}.`; // Add feedback
        checkAndSetGracePeriod(gameState, gameData); // Check if the horde is empty now. If so, set cooldowns and change game mode
    }

    // Push the final text
    gameState.status.messageQueue.push({
        text_ref: effects.result_ref,
        params: {
            numHit: allMonsters.length,
            damage: totalDamage,
            kill: killParam,
            cursed: cursedParam
        }
    });
}

/**
 * Performs special attack on the boss using special items (Black salt or Witch Ward)
 * @param {Object} effects Effects of the action that need to be handled
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
function processSpecialAttack(effects, gameState, gameData) {
    const bossType = effects.attackBoss;
    const itemID = effects.removeItem; // Item is removed by handleEffects()

    const bossList = gameState.horde[bossType];
    const itemData = gameData.items[itemID];
    // Damage = Base damage + small randomiser. Boss takes the entire damage even if the player is enfeebled.
    const damage = itemData.effects.damage + getRandomInt(-2,3);

    if (bossList && bossList.length > 0) {
        bossList[0].currentHealth -= damage; // Deal the damage to the boss. Always index 0 as only one boss spawns

        let killParam = '';
        if (bossList[0].currentHealth <= 0) {
            bossList.shift(); // Remove the boss from the horde if dead.
            
            killParam = ` You defeated the ${gameData.monsters[bossType].name}.` // Add feedback if boss is killed
            checkAndSetGracePeriod(gameState, gameData); // Check if the horde is empty now. If so, set cooldowns and change game mode
        }

        // Push the final text
        gameState.status.messageQueue.push({
            text_ref: effects.result_ref,
            params: {
                damage: damage,
                kill: killParam
            }
        });
    }
}

/**
 * Updates hiding status to normal if player chooses a non-hiding / waiting option
 * @param {Object} chosenAction Action object chosen by the player from the validActions array
 * @param {Object} gameState Current dynamic game state
 */
function updateHidingStatus(chosenAction, gameState) {
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
            
            // Push a feedback message to notify the player
            gameState.status.messageQueue.push({ 
                text_ref: "outcome_stop_hiding" 
            });
        }
    }
}