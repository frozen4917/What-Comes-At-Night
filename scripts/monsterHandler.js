import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });

import { getRandomInt, checkAndSetGracePeriod, countMonsters, formatMonsterList, chooseWeightedMove } from './utils.js';


function getTargetFortification(world) {
    switch (world.hordeLocation) {
        case "campGate": return "campGate"; // Horde at camp gate attacks gate
        case "graveyardGate": return "graveyardGate"; // Horde at graveyard gate attacks gate
        case "campsite": return "cabin"; // Horde at campsite attacks cabin
        default: return null;
    }
}

function getHordeMonsters(horde, type) {
    return horde[type].filter(m => m.persistent);
}

function getLoneMonsters(horde, type) {
    return horde[type].filter(m => !m.persistent);
}

export function trapMonster(gameState, gameData) {
    const trapKey = gameState.world.hordeLocation; // "campGate" or "graveyardGate"
    let trappedCounter = {}; // Store the counter for monsters trapped

    while (gameState.world.traps && gameState.world.traps[trapKey] > 0) {
        
        // Build a list of ONLY zombies, skeletons, and spirits currently present
        let trappableMonsters = [];
        ["zombie", "skeleton", "spirit"].forEach(type => {
            if (gameState.horde[type] && gameState.horde[type].length > 0) {
                trappableMonsters.push(...gameState.horde[type].map(m => ({ ...m, type: type })));
            }
        });

        // If no more monsters left to trap, break the loop
        if (trappableMonsters.length === 0) break;

        gameState.world.traps[trapKey]--; 

        // Pick a random monster
        const randomIndex = getRandomInt(0, trappableMonsters.length - 1);
        const targetMonster = trappableMonsters[randomIndex];
        const targetType = targetMonster.type; // Get type directly
        const targetId = targetMonster.id;

        // Remove the monster (using filter)
        gameState.horde[targetType] = gameState.horde[targetType].filter(m => m.id !== targetId);

        // Add the type to our list for the final message
        trappedCounter[targetType] = (trappedCounter[targetType] || 0) + 1;
    }

    const totalTrapped = Object.values(trappedCounter).reduce((sum, count) => sum + count, 0);

    if (totalTrapped > 0) {
        let composition = "";

        if (totalTrapped === 1) {
            // Single kill: "a Zombie"
            const monsterType = Object.keys(trappedCounter)[0];
            composition = `a ${gameData.monsters[monsterType].name}`;
        } else {
            // Multiple kills: Count types
            composition = formatMonsterList(trappedCounter, gameData, { mode: 'counter' });
        }

        gameState.status.messageQueue.push({
            text_ref: "outcome_trap_triggered",
            params: {
                count: (totalTrapped === 2) ? 'two' : 'a',
                monsterList: composition
            }
        });
    }
}

export function processFortificationDamage(gameState, gameData) {
    const { world, horde, status } = gameState;
    const { monsters } = gameData;
    
    // If there's no horde, do nothing.
    if (!world.hordeLocation) return; 

    if (world.hordeLocation === world.currentLocation) {
        return; 
    }

    // Find the fortification the horde is currently attacking
    const fortificationID = getTargetFortification(world);
    if (!fortificationID) return;

    let fortificationHP = world.fortifications[fortificationID];

    if (fortificationHP <= 0) {
        // The fortification is *already* broken. Move the horde immediately.
        
        let newHordeLocation = "";
        if (world.hordeLocation === "campGate") newHordeLocation = "campsite";
        if (world.hordeLocation === "graveyardGate") newHordeLocation = "graveyard";
        if (world.hordeLocation === "campsite") newHordeLocation = "cabin";
        
        if (newHordeLocation) {
            world.hordeLocation = newHordeLocation;
            let noLongerHiding = '';
            // Check if this move forces the player out of hiding
            if (newHordeLocation === gameState.world.currentLocation && gameState.status.playerState === "hiding") {
                gameState.status.playerState = "normal";
                noLongerHiding = " You were spotted instantly. You are no longer hidden!";
            }

            gameState.status.messageQueue.push({
                text_ref: "threat_fortification_non_existing_" + fortificationID,
                params: { 
                    noLongerHiding: noLongerHiding 
                }
            });
        }
        return; // Horde has moved. Nothing further
    }
    
    // Only attack if the fortification is standing
    if (fortificationHP > 0) {
        let totalDamage = 0;

        // Loop through all monster types
        // If can attack fortification, good.
        // Calculate damage from that type alone

        // monster counter
        const allMonsters = countMonsters(horde, "all", gameData);
        // array of monsters that can attack fortification
        const monsterTypes = Object.keys(allMonsters).filter(type => monsters[type].behavior.target.includes("fortification"));
        for (const type of monsterTypes) {
            const count = allMonsters[type]
            const monsterData = monsters[type];

            totalDamage += (monsterData.behavior.damage * count) + getRandomInt(-1 * count, count);
        }


        // --- Push Horde Attack Message ---
        let monsterListString = "";
        let totalAttackerCount = 0;
        if (totalDamage > 0) {
            if (status.gameMode === 'combat') {
                monsterListString = 'The horde';
            } else {
                const attackerCounter = monsterTypes.reduce((acc, type) => {
                    if (allMonsters[type] > 0) {
                        acc[type] = allMonsters[type];
                    }
                    return acc;
                }, {});
                totalAttackerCount = Object.values(attackerCounter).reduce((sum, count) => sum + count, 0);

                monsterListString = formatMonsterList(attackerCounter, gameData, { 
                    mode: 'determiner', 
                    determiner: 'the' 
                });
            }

            fortificationHP = Math.max(0, fortificationHP - totalDamage)
            gameState.status.messageQueue.push({
                text_ref: "threat_horde_attacks_fortification_" + fortificationID,
                params: {
                    totalDamage: totalDamage,
                    monsterList: monsterListString[0].toUpperCase() + monsterListString.substring(1),
                    slamVerb: (totalAttackerCount > 1) ? "slam" : "slams",
                    damageVerb: (totalAttackerCount > 1) ? "damage" : "damages",
                    attackVerb: (totalAttackerCount > 1) ? "attack" : "attacks"
                }
            });
        }

        // --- Handle Breach ---
        if (fortificationHP <= 0) {
            fortificationHP = 0;

            // Logic to move horde "inside"
            let newHordeLocation = "";
            if (world.hordeLocation === "campGate") newHordeLocation = "campsite";
            if (world.hordeLocation === "graveyardGate") newHordeLocation = "graveyard";
            if (world.hordeLocation === "campsite") newHordeLocation = "cabin";
            
            let noLongerHiding = '';
            if (newHordeLocation === gameState.world.currentLocation) {
                // If the player was hiding, they are NOT anymore.
                if (gameState.status.playerState === "hiding") {
                    gameState.status.playerState = "normal";
                    noLongerHiding = " You were spotted instantly. You are no longer hidden!"
                }
            }
            
            world.hordeLocation = newHordeLocation;
            gameState.status.messageQueue.push({
                text_ref: "threat_fortification_breached_" + fortificationID,
                params: { 
                    noLongerHiding: noLongerHiding 
                }
            });
        }
        
        // Update the fortification's final HP
        world.fortifications[fortificationID] = fortificationHP;
    }
}

export function processTimedEvents(gameState, gameData) {
    const { world, horde } = gameState;
    const { phases, monsters } = gameData;

    // Find the current phase data
    const currentPhase = phases.phases.find(p => p.id === world.currentPhaseId);
    if (!currentPhase || !currentPhase.events) return;

    // Check if any event triggers on the current action count
    const event = currentPhase.events.find(e => e.trigger.value === world.actionsRemaining);
    if (!event) return;

    // --- A Horde Spawn Event is Triggered! ---
    const spawnList = event.effect.spawn;
    let spawnCounts = {};

    // Convert non-persistent to persistent
    for (const monsterType in horde) {
        horde[monsterType].forEach(monster => {
            monster.persistent = true;
        });
    }

    // 1. Spawn new monsters
    for (const spawn of spawnList) {
        if (spawn.monster) {
            const monsterType = spawn.monster;
            const count = spawn.count;
            const monsterData = monsters[monsterType];

            for (let i = 0; i < count; i++) {
                horde[monsterType].push({
                    id: `${monsterType}_${world.currentPhaseId}_${i}`,
                    currentHealth: monsterData.health + getRandomInt(-1, 1),
                    persistent: true
                });
            }
            spawnCounts[monsterType] = (spawnCounts[monsterType] || 0) + count;

        } else if (spawn.bossPool) {
            const bossPool = spawn.bossPool;
            const count = spawn.count
            const randomIndex = getRandomInt(0, bossPool.length - 1); // 0 or 1 here
            const bossType = bossPool[randomIndex]; // "witch"/"vampire"
            const monsterData = monsters[bossType];

            for (let i = 0; i < count; i++) {
                horde[bossType].push({
                    id: `${bossType}_${world.currentPhaseId}_${i}`,
                    currentHealth: monsterData.health + getRandomInt(-1, 1),
                    persistent: true
                });
            }
            
            spawnCounts[bossType] = (spawnCounts[bossType] || 0) + count;
        }
    }

    // 2. Set Horde Location (if not already set)
    if (!world.hordeLocation) {
        if (world.currentLocation === "campsite" || world.currentLocation === "cabin") {
            world.hordeLocation = "campGate";
        } else if (world.currentLocation === "graveyard") {
            world.hordeLocation = "graveyardGate";
        }
    }

    gameState.status.gameMode = 'combat';

    // 3. Push the main spawn message
    const composition = formatMonsterList(spawnCounts, gameData, { mode: 'counter' });
    if (composition) {
        gameState.status.messageQueue.push({
            text_ref: "threat_horde_spawn_timed_" + world.currentPhaseId,
            params: { 
                composition: composition 
            }
        });
    }
}

export function processNoiseSpawning(gameState, gameData) {
    const { world, status, horde } = gameState;
    const { phases, monsters } = gameData;

    // Check if noise threshold is met
    if (world.noise < 50) return;
    
    // Check if a "grace period" is active (after clearing all monsters)
    if (status.gracePeriodCooldown > 0) return; // Player is in a grace period

    // Check if the "repeated spawn" cooldown is active (after a recent spawn)
    if (status.repeatedSpawnCooldown > 0) return; // A monster just spawned recently

    // Find the current phase's noise spawn pool
    const currentPhase = phases.phases.find(p => p.id === world.currentPhaseId);
    if (!currentPhase || !currentPhase.noiseSpawnPool || currentPhase.noiseSpawnPool.length === 0) {
        return; // Phase doesn't spawn monsters from noise
    }

    // --- All checks passed, spawn a monster! ---

    // Select a random monster type from the pool
    const pool = currentPhase.noiseSpawnPool;
    const monsterType = pool[Math.floor(Math.random() * pool.length)];
    const monsterData = monsters[monsterType];

    // Create the monster instance
    const newMonster = {
        id: `${monsterType}_noise_${status.noiseSpawnCount}`,
        currentHealth: monsterData.health + getRandomInt(-3, 1),
        persistent: false // This marks it as a "lone" monster
    };

    // Add monster to the horde list and update status
    horde[monsterType].push(newMonster);
    status.gameMode = "combat_lone";      // Change game mode
    status.repeatedSpawnCooldown = 3;   // Set the 3-turn REPEAT cooldown
    status.noiseSpawnCount++;  // Increment the unique ID counter

    // Set horde location
    if (!world.hordeLocation) {
        if (world.currentLocation === "campsite" || world.currentLocation === "cabin") {
            world.hordeLocation = "campGate";
        } else if (world.currentLocation === "graveyard") {
            world.hordeLocation = "graveyardGate";
        }
    }

    // Add a message to the queue
    gameState.status.messageQueue.push({
        text_ref: "threat_noise_spawn", // e.g., "The noise attracts a {monsterName}!"
        params: { 
            monsterName: monsterData.name 
        }
    });
}

export function processNoiseDespawning(gameState, gameData) {
    const { world, horde, status } = gameState;
    const { monsters } = gameData;

    if (status.gameMode !== 'combat_lone') return;

    // If player is not hiding, monsters are engaged. Do not despawn
    // Distance is not too far (player and monsters are not 'two' moves away). Do not Despawn
    if (status.playerState !== "hiding" && !(world.currentLocation === 'cabin' && world.hordeLocation === 'campGate')) return;

    // Stores the counts directly by type, e.g: { zombie: 2, spirit: 1 }
    const despawnedCounts = {};

    // Check for short-lingering monsters and add them to the list if noise is low enough.
    if (world.noise < 35) {
        const shortLingerers = countMonsters(horde, "lingers_short", gameData);
        Object.assign(despawnedCounts, shortLingerers);
    }

    // Check for long-lingering monsters and add them to the list.
    if (world.noise < 25) {
        const longLingerers = countMonsters(horde, "lingers_long", gameData);
        Object.assign(despawnedCounts, longLingerers);
    }
    // Remove the identified monsters from the game state.
    const despawnedTypes = Object.keys(despawnedCounts);

    if (despawnedTypes.length > 0) {
        for (const monsterType of despawnedTypes) {
            // As gameMode is 'combat_lone', all monsters of this type are lone monsters.
            // Clear the array
            horde[monsterType] = [];
        }
    }

    if (despawnedTypes.length === 0) {
        return;
    }

    // Generate the combined despawn message
    // Convert counter object to string
    const monsterListString = formatMonsterList(despawnedCounts, gameData, { 
        mode: 'determiner', 
        determiner: 'the' 
    });
    const totalDespawned = Object.values(despawnedCounts).reduce((sum, count) => sum + count, 0);    

    // Push the single, combined message to the queue
    gameState.status.messageQueue.push({
        text_ref: "threat_noise_despawn", // e.g., "{monsterList} {verb} off..."
        params: { 
            monsterList: monsterListString,
            loseVerb: (totalDespawned > 1) ? "lose" : "loses",
            wanderVerb: (totalDespawned > 1) ? "wander" : "wanders"
        }
    });
    

    checkAndSetGracePeriod(gameState)
}


export function processPlayerDamage(gameState, gameData) {
    const { world, horde, status } = gameState;
    const { monsters } = gameData;

    // --- 1. Location check ---
    // ### REMOVED and TRANSFERED into the loop

    // --- 2. Calculate Damage ---
    let totalDamage = 0;

    // Get all monsters at the player's location
    const monsterCounter = countMonsters(horde, "all", gameData);
    const monsterTypes = Object.keys(monsterCounter);
    const playerAttackerCounter = {};
    for (const type of monsterTypes) {
        const monsterData = monsters[type];
        
        if (monsterData && monsterData.behavior.target.includes("player")) {
            playerAttackerCounter[type] = monsterCounter[type];
            let bossSpecialAttackPerformed = false;
            switch (type) {
                case "vampire": 
                    bossSpecialAttackPerformed = handleVampireAttack(gameState, gameData);
                    break;
                
                case "witch":
                    bossSpecialAttackPerformed = handleWitchAttack(gameState, gameData);
                    break;
                
                default:
                    bossSpecialAttackPerformed = false;
                    break;
            }
            if (bossSpecialAttackPerformed || world.hordeLocation !== world.currentLocation) continue;

            const count = monsterCounter[type];
            totalDamage += (monsterData.behavior.damage * count) + getRandomInt(-1 * count, count);
        }
    }
    
    if (totalDamage <= 0) return; // No player-attacking monsters are present or no damage was dealt if vampire is the last monster and used a special ability

    // --- 3. Text & Message ---
    let monsterListString = "";
    let totalMonsterCount = 0;

    if (status.gameMode === 'combat') {
        monsterListString = 'The horde';
    } else {
        monsterListString = formatMonsterList(playerAttackerCounter, gameData, { 
            mode: 'determiner', 
            determiner: 'the' 
        });
        totalMonsterCount = Object.values(playerAttackerCounter).reduce((sum, count) => sum + count, 0);
    }

    // --- 5. Apply Damage and Push Message ---
    gameState.player.health = Math.max(0, gameState.player.health - totalDamage);
    
    gameState.status.messageQueue.push({
        text_ref: "threat_horde_attacks_player",
        params: {
            totalDamage: totalDamage,
            monsterList: monsterListString[0].toUpperCase() + monsterListString.substring(1),
            swarmVerb: (totalMonsterCount > 1) ? "swarm" : "swarms"
        }
    });
}

function handleVampireAttack(gameState, gameData) {
    const { player, horde, world, status } = gameState;
    const vampireInstance = horde.vampire[0];
    const vampireData = gameData.monsters.vampire;

    let movePool = [];

    // Special 1: Life Drain - 25% - Player HP > 60 + Vampire health < Max health + same location
    if (player.health > 60 && vampireInstance.currentHealth < vampireData.health && world.currentLocation === world.hordeLocation) {
        movePool.push({ name: "life_drain", weight: 25 });
    }

    // Special 2: Enfeebling - 25% - Player NOT cursed, Player Stamina > 45, Can occur from distance
    if (player.stamina > 40 && !world.flags.enfeebled) {
        movePool.push({ name: "enfeebling", weight: 25 });
    }

    const specialMovesWeight = movePool.reduce((sum, move) => sum + move.weight, 0);
    movePool.push({ name: "default", weight: 100 - specialMovesWeight });

    const chosenMove = chooseWeightedMove(movePool);
    switch (chosenMove.name) {
        case "life_drain":
            const playerDamage = vampireData.behavior.damage + getRandomInt(-1, 1);
            const vampireHeal = Math.min(playerDamage, vampireData.health - vampireInstance.currentHealth);
            player.health = Math.max(0, player.health - playerDamage);
            vampireInstance.currentHealth += vampireHeal;
            status.messageQueue.push({ 
                text_ref: "threat_vampire_life_drain", 
                params: { 
                    damage: playerDamage, 
                    heal: vampireHeal
                } 
            });
            return true;

        case "enfeebling":
            world.flags.enfeebled = true;
            status.messageQueue.push({ 
                text_ref: "threat_vampire_enfeeble" 
            });
            return true;

        case "default":
            status.messageQueue.push({ 
                text_ref: "threat_vampire_presence" // TO REMOVE LATER
            });
            return false;
    }
}

function handleWitchAttack(gameState, gameData) {
    const { player, horde, world, status } = gameState;
    const witchInstance = horde.witch[0];
    const witchData = gameData.monsters.witch;

    let movePool = [];

    // Special 1: Heals Horde - 25% - Atleast 2 other non-boss are below 60% health
    let healableMonsters = 0;
    const monsterTypes = ["zombie", "skeleton", "spirit"];
    for (const type of monsterTypes) {
        if (!horde[type]) continue;

        const typeMaxHealth = gameData.monsters[type].health;
        for (const monster of horde[type]) {
            if (monster.currentHealth < (typeMaxHealth * 0.6)) {
                healableMonsters++;
            }
        }
    }
    if (healableMonsters >= 2) {
        movePool.push({ name: "heal_horde", weight: 25 });
    }

    // Special 2: Throws potion - 30% - Player not too far away (not allowed condition - Player: cabin, Witch: campGate)
    if (!(world.currentLocation === 'cabin' && world.hordeLocation === 'campGate')) {
        movePool.push({ name: "throw_potion", weight: 30 });
    }

    const specialMovesWeight = movePool.reduce((sum, move) => sum + move.weight, 0);
    movePool.push({ name: "default", weight: 100 - specialMovesWeight });

    const chosenMove = chooseWeightedMove(movePool);
    switch (chosenMove.name) {
        case "heal_horde":
            const healAmount = 8;
            let totalHeal = 0;
            for (const type of monsterTypes) {
                if (!horde[type]) continue;
                const typeMaxHealth = gameData.monsters[type].health;
                for (const monster of horde[type]) {
                    const originalHealth = monster.currentHealth;
                    monster.currentHealth = Math.min(typeMaxHealth, originalHealth + healAmount);

                    totalHeal += (monster.currentHealth - originalHealth);
                }
            }
            status.messageQueue.push({ 
                text_ref: "threat_witch_heal_horde", 
                params: { 
                    heal: totalHeal
                } 
            });
            return true;

        case "throw_potion":
            const potionDamage = getRandomInt(6, 15);
            player.health = Math.max(0, player.health - potionDamage);
            status.messageQueue.push({ 
                text_ref: "threat_witch_throw_potion",
                params: {
                    damage: potionDamage
                }
            });
            return true;

        case "default":
            status.messageQueue.push({ 
                text_ref: "threat_witch_presence" // TO REMOVE LATER
            });
            return false;
    }
}