/**
 * @file loader.js
 * @description Data Loader.
 * Handles fetching and parsing all JSON game data from the `/public/data/` directory.
 * This acts as the bridge between the static data files and the active game state.
 */

/**
 * Loads game-related data
 * @returns {Object} gameData object comprising of all game data
 */
export async function loadGameData() {

    // All data files in /public/data/
    const fileNames = [
        'globalActions.json',
        'initialState.json',
        'items.json',
        'locations.json',
        'monsters.json',
        'phases.json',
        'settings.json',
        'texts.json'
    ];

    try {
        // Create an array of fetch promises
        const filePromises = fileNames.map(async (fileName) => {
            // The browser knows to look in 'public' for this path
            const response = await fetch(`/data/${fileName}`);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${fileName}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Get the name of the file without .json (e.g., "monsters")
            const name = fileName.substring(0, fileName.lastIndexOf('.'));

            return {
                name: name,
                data: data
            };
        });

        // Wait for all files to be fetched and parsed
        const loadedDataArray = await Promise.all(filePromises);

        // Reduce the array into the final gameData object, just like the original
        const gameData = loadedDataArray.reduce((acc, current) => {
            acc[current.name] = current.data;
            return acc;
        }, {});

        return gameData; // Returns the actual gameData object

    } catch (error) {
        // If any file is missing or has a JSON error, the game will stop
        console.error("FATAL ERROR: Could not load game data. Check JSON files in /public/data/");
        console.error(error);
        
        throw error;
    }
}