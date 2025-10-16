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

            // You can add more conditions here later, like "playerHealthIsBelow", etc.

            default:
                // If the condition is unknown, assume it's okay for now.
                return true;
        }
    });
}