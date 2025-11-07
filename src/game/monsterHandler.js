import { getRandomInt, checkAndSetGracePeriod, countMonsters, formatMonsterList, chooseWeightedMove } from './utils.js';

/**
 * Returns the fortification that horde has to attack based on the horde's location
 * @param {Object} world The world object from gameState.world
 * @returns {string} Fortification that needs to be attacked
 */
function getTargetFortification(world) {
    switch (world.hordeLocation) {
        case "campGate": return "campGate"; // Horde at camp gate attacks gate
        case "graveyardGate": return "graveyardGate"; // Horde at graveyard gate attacks gate
        case "campsite": return "cabin"; // Horde at campsite attacks cabin
        default: return null;
    }
}

/**
 * Trigger traps set by player at gates when monsters/horde spawns in
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function trapMonster(gameState, gameData) {
    const trapKey = gameState.world.hordeLocation; // The horde location: "campGate" or "graveyardGate". 
    let trappedCounter = {}; // Counter for monsters trapped, e.g. { zombie: 1, spirit: 1 }

    // Runs as long as number of traps at the location is greater than 0 (trap multiple monsters)
    while (gameState.world.traps && gameState.world.traps[trapKey] > 0) {
        
        // Build a list of ONLY zombies, skeletons, and spirits currently present. Only they can be trapped. Boss monsters cannot be trapped
        let trappableMonsters = []; // Stores monster instances that can be trapped along with their type
        ["zombie", "skeleton", "spirit"].forEach(type => {
            if (gameState.horde[type] && gameState.horde[type].length > 0) {
                trappableMonsters.push(...gameState.horde[type].map(m => ({ ...m, type: type })));
            }
        });

        // If no more monsters left to trap, break the loop
        if (trappableMonsters.length === 0) break;

        gameState.world.traps[trapKey]--; // Consume the trap

        // Pick a random monster
        const randomIndex = getRandomInt(0, trappableMonsters.length - 1);
        const targetMonster = trappableMonsters[randomIndex]; // Choose the random target
        const targetType = targetMonster.type
        const targetId = targetMonster.id;

        // Remove the monster (monster is killed instantly)
        gameState.horde[targetType] = gameState.horde[targetType].filter(m => m.id !== targetId);

        // Add the type to the counter for the final message
        trappedCounter[targetType] = (trappedCounter[targetType] || 0) + 1;
    }

    // Get the total count from the counter
    const totalTrapped = Object.values(trappedCounter).reduce((sum, count) => sum + count, 0);

    // Check if atleast one trap was triggered. If so, create a message and push it into the messageQueue.
    if (totalTrapped > 0) {
        let composition = ""; // String that lists the composition, e.g. "a Zombie", or "2 Zombies"

        if (totalTrapped === 1) {
            // Single kill, e.g. "a Zombie"
            const monsterType = Object.keys(trappedCounter)[0];
            composition = `a ${gameData.monsters[monsterType].name}`;
        } else {
            // Multiple kills: Count types, e.g. "2 Zombies", or "1 Zombie and 1 Skeleton"
            composition = formatMonsterList(trappedCounter, gameData, { mode: 'counter' });
        }

        // Push the final message
        gameState.status.messageQueue.push({
            text_ref: "outcome_trap_triggered",
            params: {
                count: (totalTrapped === 2) ? 'two' : 'a', // If 2 traps were triggered, set count as "two", else "a". Maximum number of traps that can be fetched in the world is 2 (limit of 2 nets at pier).
                monsterList: composition
            }
        });
    }
}

/**
 * Processes damage on fortification from monsters
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function processFortificationDamage(gameState, gameData) {
    const { world, horde, status } = gameState;
    const { monsters } = gameData;
    
    // If there's no horde, do nothing.
    if (!world.hordeLocation) return; 

    // If horde and player are at the same location, do nothing. Instead, player will take damage.
    if (world.hordeLocation === world.currentLocation) return; 

    // Find the fortification the horde is currently attacking
    const fortificationID = getTargetFortification(world);
    if (!fortificationID) return;

    let fortificationHP = world.fortifications[fortificationID];

    if (fortificationHP <= 0) {
        // --- The fortification is *already* broken. Move the horde immediately. ---
        
        let newHordeLocation = "";
        if (world.hordeLocation === "campGate") newHordeLocation = "campsite";
        if (world.hordeLocation === "graveyardGate") newHordeLocation = "graveyard";
        if (world.hordeLocation === "campsite") newHordeLocation = "cabin";
        
        if (newHordeLocation) {
            world.hordeLocation = newHordeLocation; // Move the horde
            let noLongerHiding = '';

            // Check if player is in this new location AND if they are hiding. If so, force them out of hiding.
            if (newHordeLocation === gameState.world.currentLocation && gameState.status.playerState === "hiding") {
                gameState.status.playerState = "normal";
                noLongerHiding = " You were spotted instantly. You are no longer hidden!";
            }

            // Push the final feedback message (Fortification was broken, horde moved in)
            gameState.status.messageQueue.push({
                text_ref: "threat_fortification_non_existing_" + fortificationID,
                params: { 
                    noLongerHiding: noLongerHiding 
                }
            });
        }
        return; // Horde has moved. Nothing further to do.
    }
    
    // Attack fortification only if there is a standing fortification
    if (fortificationHP > 0) {
        // --- Fortification is standing. Attack it ---
        let totalDamage = 0;

        // Loop through all monster types. If it can attack fortification, calculate damage for that type. If it cannot attack, skip it

        const allMonsters = countMonsters(horde, "all", gameData); // Monster counter of "all" type, e.g. { zombie: 2, skeleton: 1, witch: 1 }

        const monsterTypes = Object.keys(allMonsters).filter(type => monsters[type].behavior.target.includes("fortification")); // Filters through allMonsters's keys to find only those who can attack the fortification, e.g. [ "zombie", "witch" ]
        // Loop though the above list and calculate damage
        for (const type of monsterTypes) {
            const count = allMonsters[type]
            const monsterData = monsters[type];

            // Total damage = (Damage from one monster * number of monsters) + randomiser
            totalDamage += (monsterData.behavior.damage * count) + getRandomInt(-1 * count, count);
        }


        // --- Push Horde Attack Message ---
        let monsterListString = ""; // the composition of attackers, e.g. "2 Zombies", "1 Zombie"
        let totalAttackerCount = 0;
        // Execute if and only if some fortification damage was done.
        if (totalDamage > 0) {
            if (status.gameMode === 'combat') {
                // Player is in "combat" mode i.e. being attacked by timed horde instead of lone monsters
                monsterListString = 'The horde'; // Set the composition to "The horde"
            } else {
                // Player is in "combat_lone" mode i.e. being attacked by noise-spawned monsters
                
                // Get a counter comprising of monsters which can only attack fortification, e.g. { zombie: 2 }
                const attackerCounter = monsterTypes.reduce((acc, type) => {
                    if (allMonsters[type] > 0) {
                        acc[type] = allMonsters[type];
                    }
                    return acc;
                }, {});

                totalAttackerCount = Object.values(attackerCounter).reduce((sum, count) => sum + count, 0); // Get total attacker count from the above counter object

                // Format the string and return it using "the" determiner, e.g. "the Zombie", "the Zombies"
                monsterListString = formatMonsterList(attackerCounter, gameData, { 
                    mode: 'determiner', 
                    determiner: 'the' 
                });
            }

            fortificationHP = Math.max(0, fortificationHP - totalDamage); // Deal the actual damage to fortification now, capped at 0 minimum
            // Push the final text (Fortification attack)
            gameState.status.messageQueue.push({
                text_ref: "threat_horde_attacks_fortification_" + fortificationID,
                params: {
                    totalDamage: totalDamage,
                    monsterList: monsterListString[0].toUpperCase() + monsterListString.substring(1), // Capitalise the first letter
                    slamVerb: (totalAttackerCount > 1) ? "slam" : "slams",
                    damageVerb: (totalAttackerCount > 1) ? "damage" : "damages",
                    attackVerb: (totalAttackerCount > 1) ? "attack" : "attacks"
                }
            });
        }

        // --- Handle Breach ---
        if (fortificationHP <= 0) {
            // --- The fortification was destroyed in the attack ---
            fortificationHP = 0;

            // Move the horde "inside"
            let newHordeLocation = "";
            if (world.hordeLocation === "campGate") newHordeLocation = "campsite";
            if (world.hordeLocation === "graveyardGate") newHordeLocation = "graveyard";
            if (world.hordeLocation === "campsite") newHordeLocation = "cabin";
            
            let noLongerHiding = '';
            if (newHordeLocation === gameState.world.currentLocation) {
                if (gameState.status.playerState === "hiding") {
                    // Check if player is in this new location AND if they are hiding. If so, force them out of hiding.
                    gameState.status.playerState = "normal";
                    noLongerHiding = " You were spotted instantly. You are no longer hidden!"
                }
            }
            
            world.hordeLocation = newHordeLocation;
            // Push the final message (Fortification destroyed, player found hiding)
            gameState.status.messageQueue.push({
                text_ref: "threat_fortification_breached_" + fortificationID,
                params: { 
                    noLongerHiding: noLongerHiding 
                }
            });
        }
        
        // Finally update the fortification's final HP
        world.fortifications[fortificationID] = fortificationHP;
    }
}

/**
 * Triggers phase-driven horde spawning
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function processTimedEvents(gameState, gameData) {
    const { world, horde } = gameState;
    const { phases, monsters } = gameData;

    // Find the current phase data
    const currentPhase = phases.phases.find(p => p.id === world.currentPhaseId);
    if (!currentPhase || !currentPhase.events) return;

    // Check if any event triggers on the current action count
    const event = currentPhase.events.find(e => e.trigger.value === world.actionsRemaining);
    if (!event) return; // If not, exit early

    // --- A Horde Spawn Event is Triggered! ---
    const spawnList = event.effect.spawn;
    let spawnCounts = {}; // Counter for storing number of monsters of a specific type for message, e.g. { zombie: 3, skeleton: 2, spirit: 2 }

    // Step 1: Convert non-persistent monsters (from noise-spawning) to persistent
    // They become "intelligent" and do not despawn anymore
    for (const monsterType in horde) {
        horde[monsterType].forEach(monster => {
            monster.persistent = true;
        });
    }

    // Step 2. Spawn new monsters
    for (const spawn of spawnList) {
        if (spawn.monster) {
            // --- Normal monsters spawning ---
            const monsterType = spawn.monster;
            const count = spawn.count;
            const monsterData = monsters[monsterType];

            for (let i = 0; i < count; i++) {
                horde[monsterType].push({
                    id: `${monsterType}_${world.currentPhaseId}_${i}`, // ID for each, e.g. "zombie_deep_night_0", "spirit_nightfall_1"
                    currentHealth: monsterData.health + getRandomInt(-1, 1), // Add a small randomiser to their health
                    persistent: true // Spawn them as persistent monsters (do not despawn)
                });
            }
            spawnCounts[monsterType] = (spawnCounts[monsterType] || 0) + count; // Add to the counter for the final text

        } else if (spawn.bossPool) {
            // --- Boss spawn ---
            // Choose any one boss (vampire or witch) and spawn exactly one of them. A game may not have more than one boss.
            const bossPool = spawn.bossPool;
            const count = spawn.count
            const randomIndex = getRandomInt(0, bossPool.length - 1); // 0 or 1 index
            const bossType = bossPool[randomIndex]; // "witch" / "vampire"
            const monsterData = monsters[bossType];

            for (let i = 0; i < count; i++) {
                horde[bossType].push({
                    id: `${bossType}_${world.currentPhaseId}_${i}`, // ID for the boss, e.g. "vampire_witching_hour_0"
                    currentHealth: monsterData.health + getRandomInt(-1, 1), // Add a small randomiser to the health
                    persistent: true
                });
            }
            
            spawnCounts[bossType] = (spawnCounts[bossType] || 0) + count; // Add to the counter for the final text
        }
    }

    // Step 3. Set Horde Location if not already set by a lone monster or another horde
    if (!world.hordeLocation) {
        if (world.currentLocation === "campsite" || world.currentLocation === "cabin") {
            world.hordeLocation = "campGate"; // If the player is at cabin or campsite, spawn them at the campgate
        } else if (world.currentLocation === "graveyard") {
            world.hordeLocation = "graveyardGate"; // If the player is at graveyard, spawn them at the graveyard gate
        }
    }

    gameState.status.gameMode = 'combat'; // Update the game mode to 'combat' 

    // Step 4. Push the main spawn message
    const composition = formatMonsterList(spawnCounts, gameData, { mode: 'counter' }); // Format the spawn list into text, e.g. 3 Zombies, 2 Skeletons, and 2 Spirits"

    if (composition) {
        gameState.status.messageQueue.push({
            text_ref: "threat_horde_spawn_timed_" + world.currentPhaseId, // e.g. "threat_horde_spawn_timed_nightfall"
            params: { 
                composition: composition
            }
        });
    }
}

/**
 * Spawns lone monsters if noise gets too high
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function processNoiseSpawning(gameState, gameData) {
    const { world, status, horde } = gameState;
    const { phases, monsters } = gameData;

    // Check if noise threshold is met. If not, exit early
    if (world.noise < 50) return;
    
    // Check if a "grace period" is active (after killing all monsters or letting them despawn)
    if (status.gracePeriodCooldown > 0) return; // Player is in a grace period

    // Check if the "repeated spawn" cooldown is active (after a recent noise spawn)
    if (status.repeatedSpawnCooldown > 0) return; // A monster just spawned recently

    // Find the current phase's noise spawn pool
    const currentPhase = phases.phases.find(p => p.id === world.currentPhaseId);
    if (!currentPhase || !currentPhase.noiseSpawnPool || currentPhase.noiseSpawnPool.length === 0) {
        return; // Phase doesn't spawn monsters from noise
    }

    // ---Spawn a monster! ---

    // Step 1: Select a random monster type from the pool
    const pool = currentPhase.noiseSpawnPool;
    const monsterType = pool[Math.floor(Math.random() * pool.length)];
    const monsterData = monsters[monsterType];

    // Step 2: Create the monster instance
    const newMonster = {
        id: `${monsterType}_noise_${status.noiseSpawnCount}`, // Set ID for the monster, e.g. "spirit_noise_3"
        currentHealth: monsterData.health + getRandomInt(-3, 1), // Add a randomiser
        persistent: false // The monster is non-persistent i.e. it can despawn
    };

    // Step 3: Add monster to the horde list and update status
    horde[monsterType].push(newMonster);
    status.gameMode = "combat_lone"; // Change game mode to "combat_lone"
    status.repeatedSpawnCooldown = 3; // Set the 3-turn REPEAT cooldown. This prevents repeated spawn if the noise is continuously above the threshold
    status.noiseSpawnCount++; // Increment the unique ID counter 

    // Step 4: Set horde location if not already set by another lone monster
    if (!world.hordeLocation) {
        if (world.currentLocation === "campsite" || world.currentLocation === "cabin") {
            world.hordeLocation = "campGate"; // If player is at cabin or campsite, spawn it at campgate
        } else if (world.currentLocation === "graveyard") {
            world.hordeLocation = "graveyardGate"; // If player is at graveyard, spawn it at graveyard gate
        }
    }

    // Step 5: Add a message to the queue
    gameState.status.messageQueue.push({
        text_ref: "threat_noise_spawn",
        params: { 
            monsterName: monsterData.name 
        }
    });
}

/**
 * Despawns lone monsters if noise reduces
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function processNoiseDespawning(gameState, gameData) {
    const { world, horde, status } = gameState;

    // Only despawn if the combat mode is 'combat_lone'
    if (status.gameMode !== 'combat_lone') return;

    // Do NOT despawn if both of these condition are met:
    // (a) The player is not hiding. Monsters can see the player the player, and hence are "interested".
    // (b) The player is in a location directly accessible by the monsters (e.g. graveyardGate & graveyard, campGate & campsite, campsite & cabin). If player is at cabin while the monsters are at campsite, then they are too far away and thus can be despawned.
    if (status.playerState !== "hiding" && !(world.currentLocation === 'cabin' && world.hordeLocation === 'campGate')) return;

    // Stores the counts directly by type, e.g: { zombie: 2, spirit: 1 }
    const despawnedCounts = {};

    // Check for short-lingering monsters and add them to the list if noise is low enough.
    if (world.noise < 35) {
        const shortLingerers = countMonsters(horde, "lingers_short", gameData);
        Object.assign(despawnedCounts, shortLingerers);
    }

    // Check for long-lingering monsters and add them to the list if noise is low enough.
    if (world.noise < 25) {
        const longLingerers = countMonsters(horde, "lingers_long", gameData);
        Object.assign(despawnedCounts, longLingerers);
    }

    // Remove the identified monsters from the game state.
    const despawnedTypes = Object.keys(despawnedCounts); // Store list of monsters to be despawned, e.g. [ "zombie", "spirit" ]
    if (despawnedTypes.length > 0) {
        for (const monsterType of despawnedTypes) {
            // As gameMode is 'combat_lone', all monsters of this type are lone monsters.
            horde[monsterType] = []; // Clear the array i.e. delete all monsters of those type
        }
    }

    if (despawnedTypes.length === 0) return; // If no monsters to be despawned, exit

    // Generated formatted string using the counter object
    const monsterListString = formatMonsterList(despawnedCounts, gameData, { 
        mode: 'determiner', 
        determiner: 'the' 
    });
    const totalDespawned = Object.values(despawnedCounts).reduce((sum, count) => sum + count, 0); // Count the total number of monsters

    // Push the single, combined message to the queue
    gameState.status.messageQueue.push({
        text_ref: "threat_noise_despawn",
        params: { 
            monsterList: monsterListString,
            loseVerb: (totalDespawned > 1) ? "lose" : "loses",
            wanderVerb: (totalDespawned > 1) ? "wander" : "wanders"
        }
    });
    

    checkAndSetGracePeriod(gameState); // The horde is empty now. Set cooldowns and change game mode
}

/**
 * Process damage to player from monsters
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function processPlayerDamage(gameState, gameData) {
    const { world, horde, status } = gameState;
    const { monsters } = gameData;

    // Step 1: Calculate damage
    let totalDamage = 0;

    // Get all monsters at the player's location
    const monsterCounter = countMonsters(horde, "all", gameData); // Get the counter, e.g. { zombie: 3, spirit: 2, witch: 1 }
    const monsterTypes = Object.keys(monsterCounter); // Get the keys from the counter, e.g. [ "zombie", "spirit", "witch" ]
    const playerAttackerCounter = {}; // Counter to store the monster type that can attack player
    for (const type of monsterTypes) {
        const monsterData = monsters[type]; // Fetch data for the current monster type from monsters.json
        
        // Continue into the loop if the monster can attack the player
        if (monsterData && monsterData.behavior.target.includes("player")) {
            playerAttackerCounter[type] = monsterCounter[type]; // Add them to the attacker counter
            let bossSpecialAttackPerformed = false; // This flag stores whether or not boss used a special attack. If the boss didn't, it will be queued for a default attack.
            switch (type) {
                case "vampire":
                    bossSpecialAttackPerformed = handleVampireAttack(gameState, gameData);
                    break;
                
                case "witch":
                    bossSpecialAttackPerformed = handleWitchAttack(gameState, gameData);
                    break;
                
                default: // Not a vampire or witch
                    bossSpecialAttackPerformed = false;
                    break;
            }
            // Check if special attack was triggered, or the location for horde and player mismatch. If either is true, skip this monster type.
            // NOTE: Location is checked here as boss monsters can perform special attack from a distance too. Normal monsters need to be in the same location to attack. Default attack is to be done from the same location too.
            if (bossSpecialAttackPerformed || world.hordeLocation !== world.currentLocation) continue;

            const count = monsterCounter[type];
            // Damage = (damage from one monster of the type * number of monsters) + randomiser
            totalDamage += (monsterData.behavior.damage * count) + getRandomInt(-1 * count, count);
        }
    }
    
    if (totalDamage <= 0) return; // No player-attacking monsters are present or no damage was dealt if vampire is the last monster and used a special ability

    // Step 2: Create the message
    let monsterListString = "";
    let totalMonsterCount = 0;

    if (status.gameMode === 'combat') {
        // The game mode is 'combat'. Let the composition be just "The horde".
        monsterListString = 'The horde';
    } else {
        // The game mode is 'combat_lone'. Format the list
        monsterListString = formatMonsterList(playerAttackerCounter, gameData, { 
            mode: 'determiner', 
            determiner: 'the' 
        });
        totalMonsterCount = Object.values(playerAttackerCounter).reduce((sum, count) => sum + count, 0); // Return the total count of player-attacking monsters
    }

    // Step 3: Apply the damage and push the message
    gameState.player.health = Math.max(0, gameState.player.health - totalDamage);
    
    gameState.status.messageQueue.push({
        text_ref: "threat_horde_attacks_player",
        params: {
            totalDamage: totalDamage,
            monsterList: monsterListString[0].toUpperCase() + monsterListString.substring(1), // Capitalise the first letter
            swarmVerb: (totalMonsterCount > 1) ? "swarm" : "swarms"
        }
    });
}

/**
 * Checks conditions and performs vampire's special attack if possible.
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 * @returns {boolean} true if a special attack was triggered, else returns false
 */
function handleVampireAttack(gameState, gameData) {
    const { player, horde, world, status } = gameState;
    const vampireInstance = horde.vampire[0];
    const vampireData = gameData.monsters.vampire;

    let movePool = []; // Stores all the moves

    // Special 1: Life Drain - 25% - Player HP > 60 & Vampire health < Max health & same location
    if (player.health > 60 && vampireInstance.currentHealth < vampireData.health && world.currentLocation === world.hordeLocation) {
        movePool.push({ name: "life_drain", weight: 25 });
    }

    // Special 2: Enfeebling - 25% - Player NOT cursed & Player Stamina > 40. Can occur from distance
    if (player.stamina > 40 && !world.flags.enfeebled) {
        movePool.push({ name: "enfeebling", weight: 25 });
    }

    const specialMovesWeight = movePool.reduce((sum, move) => sum + move.weight, 0);
    movePool.push({ name: "default", weight: 100 - specialMovesWeight }); // Remaining weightage to "default"

    const chosenMove = chooseWeightedMove(movePool); // Selects a move randomly based on the weights

    switch (chosenMove.name) {
        case "life_drain":
            const playerDamage = vampireData.behavior.damage + getRandomInt(-1, 1);
            const vampireHeal = Math.min(playerDamage, vampireData.health - vampireInstance.currentHealth); // Heals the vampire, capped at vampire's max health
            player.health = Math.max(0, player.health - playerDamage);
            vampireInstance.currentHealth += vampireHeal;
            status.messageQueue.push({ 
                text_ref: "threat_vampire_life_drain", 
                params: { 
                    damage: playerDamage, 
                    heal: vampireHeal
                } 
            });
            return true; // Special attack was performed

        case "enfeebling":
            world.flags.enfeebled = true; // Set the debuff to true. Enfeebling curse is now active
            status.messageQueue.push({ 
                text_ref: "threat_vampire_enfeeble" 
            });
            return true; // Special attack was performed

        case "default":
            status.messageQueue.push({ 
                text_ref: "threat_vampire_presence" // TO REMOVE LATER
            });
            return false; // Special attack was NOT performed
    }
}

/**
 * Checks conditions and performs witch's special attack if possible.
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 * @returns {boolean} true if a special attack was triggered, else returns false
 */
function handleWitchAttack(gameState, gameData) {
    const { player, horde, world, status } = gameState;

    let movePool = []; // Stores all the moves

    // Special 1: Heals Horde - 25% - Atleast 2 other non-boss are below 60% health
    let healableMonsters = 0;
    const monsterTypes = ["zombie", "skeleton", "spirit"]; // Non-boss monsters
    for (const type of monsterTypes) {
        if (!horde[type]) continue; // If no monsters in the horde, skip that type

        const typeMaxHealth = gameData.monsters[type].health;
        for (const monster of horde[type]) {
            if (monster.currentHealth < (typeMaxHealth * 0.6)) {
                healableMonsters++; // If the monster health is less than 60% of its max health, it can be healed.
            }
        }
    }
    if (healableMonsters >= 2) {
        movePool.push({ name: "heal_horde", weight: 25 });
    }

    // Special 2: Throws potion - 30% - Player is not too far away (Not allowed condition: Player at cabin, Witch at campGate)
    if (!(world.currentLocation === 'cabin' && world.hordeLocation === 'campGate')) {
        movePool.push({ name: "throw_potion", weight: 30 });
    }

    const specialMovesWeight = movePool.reduce((sum, move) => sum + move.weight, 0);
    movePool.push({ name: "default", weight: 100 - specialMovesWeight }); // Remaining weightage to "default"

    const chosenMove = chooseWeightedMove(movePool); // Selects a move randomly based on the weights
    
    switch (chosenMove.name) {
        case "heal_horde":
            const healAmount = 8;
            let totalHeal = 0;
            for (const type of monsterTypes) {
                if (!horde[type]) continue; // If no monsters of that type, skip it
                // NOTE: All monsters in the horde are healed, even those above 60% health.

                const typeMaxHealth = gameData.monsters[type].health;
                for (const monster of horde[type]) {
                    const originalHealth = monster.currentHealth;
                    monster.currentHealth = Math.min(typeMaxHealth, originalHealth + healAmount); // Heal the monster, capped at its max health

                    totalHeal += (monster.currentHealth - originalHealth);
                }
            }
            status.messageQueue.push({ 
                text_ref: "threat_witch_heal_horde", 
                params: { 
                    heal: totalHeal
                } 
            });
            return true; // Special attack was performed

        case "throw_potion":
            const potionDamage = getRandomInt(6, 15);
            player.health = Math.max(0, player.health - potionDamage); // Damage the player from a distance using the potion
            status.messageQueue.push({ 
                text_ref: "threat_witch_throw_potion",
                params: {
                    damage: potionDamage
                }
            });
            return true; // Special attack was performed

        case "default":
            status.messageQueue.push({ 
                text_ref: "threat_witch_presence" // TO REMOVE LATER
            });
            return false; // Special attack was NOT performed
    }
}