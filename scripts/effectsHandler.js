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
            
            case "addTrap":
                gameState.world.traps[value] +=  1;
                gameState.player.inventory.wood -= 1;
                gameState.player.inventory.net -= 1;
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
                // All attack effects are handled by one helper
                processAttackEffect(effects, gameState, gameData);
                specialMessageHandled = true;
                break;

            case "attackBoss":
            case "attackTarget":
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

export function processAttackEffect(effects, gameState, gameData) {
    let weaponID = null;
    if (effects.weaponPriority) {
        for (const id of effects.weaponPriority) {
            if (gameState.player.inventory[id] > 0) {
                weaponID = id;
                break;
            }
        }
    }

    switch (effects.attackType) {
        case "cleave":
            return processCleaveAttack(effects, weaponID, gameState, gameData);
        
        case "shoot": 
            return processShootAttack(effects, gameState, gameData);
        
        case "incinerate":
            return processIncinerateAttack(effects, gameState, gameData);
        
        case "single": 
            return processSingleAttack(effects, weaponID, gameState, gameData);
        
        case "special": 
            return processSpecialAttack(effects, gameState, gameData);
    }
}

function processSingleAttack(effects, weaponID, gameState, gameData) {
    if (!weaponID) return;

    const weaponData = gameData.items[weaponID];
    const baseDamage = weaponData.effects.single_attack.damage;
    const damage = baseDamage + getRandomInt(-2, 2);
    const target = effects.attackTarget;
    const hordeList = gameState.horde[target];

    if (hordeList && hordeList.length > 0) {
        const randomIndex = getRandomInt(0, hordeList.length - 1);
        const monster = hordeList[randomIndex];
        monster.currentHealth -= damage;

        let killParam = '';
        if (monster.currentHealth <= 0) {
            hordeList.splice(randomIndex, 1); // Remove the defeated monster
            
            killParam = ` You killed the ${gameData.monsters[target].name}.`; // e.g. "outcome_attack_single_zombie_kill"
        }

        gameState.status.messageQueue.push({
            text_ref: effects.result_ref,
            params: {
                weapon: weaponData.name,
                damage: damage,
                kill: killParam
            }
        });
    }
}

function processCleaveAttack(effects, weaponID, gameState, gameData) {
    if (weaponID !== 'axe') return;

    const weaponData = gameData.items[weaponID];
    const baseDamage = weaponData.effects.cleave_attack.damage;
    const maxTargets = weaponData.effects.cleave_attack.targets;

    let allMonsters = Object.values(gameState.horde).flat();
    allMonsters.sort(() => 0.5 - Math.random());

    let targetsHit = allMonsters.slice(0, maxTargets);
    let defeatedCount = 0;
    let totalDamage = 0;
    // Attack each target
    targetsHit.forEach(monster => {
        let damage = baseDamage + getRandomInt(-1, 2);
        monster.currentHealth -= damage;
        totalDamage += damage;
        if (monster.currentHealth <= 0) {
            defeatedCount++;
        }
    });

    for (const type in gameState.horde) {
        gameState.horde[type] = gameState.horde[type].filter(m => m.currentHealth > 0);
    }

    let killParam = '';
    if (defeatedCount > 0) {
        killParam = ` You defeated the ${defeatedCount} monsters.`;
    }

    gameState.status.messageQueue.push({
        text_ref: effects.result_ref,
        params: {
            numHit: targetsHit.length,
            damage: totalDamage,
            kill: killParam
        }
    });
}

function processShootAttack(effects, gameState, gameData) {
    if (gameState.player.inventory.arrow <= 0) {
        console.log(chalk.redBright("ERROR: No arrows - [processShootAttack()]"));
        return;
    }

    gameState.player.inventory.arrow--;
    const weaponData = gameData.items.bow;
    const damage = weaponData.effects.single_attack.damage + getRandomInt(-1, 1);
    const targetOrder = ["witch", "vampire", "zombie", "skeleton", "spirit"];
    let targetMonster = null;
    let targetName = null;
    let targetList = null;
    let randomIndex = -1;

    for (const type of targetOrder) {
        if (gameState.horde[type] && gameState.horde[type].length > 0) {
            targetList = gameState.horde[type];
            randomIndex = getRandomInt(0, targetList.length - 1);
            targetMonster = targetList[randomIndex];
            targetName = gameData.monsters[type].name;
            break;
        }
    }

    targetMonster.currentHealth -= damage;

    let killParam = '';
    if (targetMonster.currentHealth <= 0) {
        targetList.splice(randomIndex, 1); // Remove the defeated monster
        killParam = ` You shot the ${targetName} to death.`;
    }

    gameState.status.messageQueue.push({
        text_ref: effects.result_ref,
        params: {
            monster: targetName,
            damage: damage,
            kill: killParam
        }
    });

}

function processIncinerateAttack(effects, gameState, gameData) {
    if (gameState.player.inventory.molotov <= 0) {
        console.log(chalk.redBright("ERROR: No Molotovs - [processIncinerateAttack()]"));
        return;
    }

    gameState.player.inventory.molotov--;
    const weaponData = gameData.items.molotov;
    const baseDamage = weaponData.effects.incinerate.damage;

    let allMonsters = Object.values(gameState.horde).flat();
    
    let defeatedCount = 0;
    let totalDamage = 0;
    
    allMonsters.forEach(monster => {
        let damage = baseDamage + getRandomInt(-4, 3);
        monster.currentHealth -= baseDamage;
        totalDamage += damage;
        if (monster.currentHealth <= 0) {
            defeatedCount++;
        }
    });

    for (const type in gameState.horde) {
        gameState.horde[type] = gameState.horde[type].filter(m => m.currentHealth > 0);
    } 

    let killParam = '';
    if (defeatedCount > 0) {
        killParam = ` The fire ends up killing ${defeatedCount} monsters.`;
    }

    gameState.status.messageQueue.push({
        text_ref: effects.result_ref,
        params: {
            numHit: allMonsters.length,
            damage: totalDamage,
            kill: killParam
        }
    });
}

function processSpecialAttack(effects, gameState, gameData) {
    const bossType = effects.attackBoss;
    const itemID = effects.removeItem;

    const bossList = gameState.horde[bossType];
    const itemData = gameData.items[itemID];
    const damage = itemData.effects.damage + getRandomInt(-2,3);

    if (bossList && bossList.length > 0) {
        bossList[0].currentHealth -= damage;

        let killParam = '';
        if (bossList[0].currentHealth <= 0) {
            bossList.shift();
            
            killParam = ` You defeated the ${gameData.monsters[bossType].name}.`
        }

        gameState.status.messageQueue.push({
            text_ref: effects.result_ref,
            params: {
                damage: damage,
                kill: killParam
            }
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