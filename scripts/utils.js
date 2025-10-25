import chalk from "chalk";

// RANDOM INT FROM MIN TO MAX
export function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Checks if conditions in showIf are met. If not, doesn't show the option
export function areConditionsMet(conditions, gameState) {
    // If there's no showIf array, the action is always available.
    if (!conditions) {
        return true;
    }

    // .every() checks if ALL conditions in the array return true.
    return conditions.every(condition => {
        const key = Object.keys(condition)[0];
        const value = condition[key];

        switch (key) {
            case "gameModeIs":
                return gameState.status.gameMode === value;
            
            case "hordeLocationNotIn":
                // Checks if the current location is NOT in the forbidden list.
                return !value.includes(gameState.world.hordeLocation);

            case "hasItem":
                // Checks if the item exists in inventory and has a quantity > 0.
                return gameState.player.inventory[value] > 0;

            case "hasAnyItem":
                    return value.some(item => gameState.player.inventory[item] > 0);
                
            case "hasItems": 
                return Object.entries(value).every(([item, quantity]) => 
                    (gameState.player.inventory[item] || 0) >= quantity
                );
            
            case "atLocation":
                return gameState.world.currentLocation === value;

            case "notScavenged":
                return !gameState.world.scavengedLocations.includes(value);
            
            case "flagIsTrue":
                return gameState.world.flags[value] === true;
            
            case "flagIsFalse":
                return gameState.world.flags[value] === false;
            
            case "monsterIsPresent":
                return gameState.horde[value] && gameState.horde[value].length > 0;
            
            case "bossIsPresent":
                return gameState.horde[value] && gameState.horde[value].length > 0;

            case "hordeSizeIsGreaterThan":
                const totalMonsters = Object.values(gameState.horde).reduce((sum, list) => sum + list.length, 0);
                return totalMonsters > value;
            
            default:
                // If the condition is unknown, assume it's okay for now.
                console.warn(chalk.red(`Unknown condition key: ${key}`));
                return true;
        }
    });
}

export function renderText(template, params) {
    if (!params) return template;
    // template is the text with placeholders, example: "You dealt {damage} HP of damage""
    // params is an object comprising of placeholder values example: {"damage": 23}

    const regex = /{(\w+)}/g;
    return template.replace(regex, (match, key) => {
        // 'match' is the full text that was matched, example, {damage}
        // 'key' is just the captured part (the word inside), example., "damage"

        // Check if the key exists in params object.
        // If it does, return the value from the params.
        // If it doesn't, return the original match
        return params[key] !== undefined ? params[key] : match;
    });
}