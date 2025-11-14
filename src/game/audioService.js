import { Howl, Howler } from 'howler';

// --- Audio Configuration ---
const MUSIC_FADE_TIME = 2000; // 2 seconds for fade in/out
let currentTrackName = ""; // The File Name of the track that is playing

// 2 players for crossfade
let playerA = null, playerB = null;
let activePlayer = 'A'; // Tracks which player is currently active

export function unlockAudio() {
    // Howler.state will be 'suspended' if audio is locked.
    // If it's 'running', audio is already playing and we do nothing.
    if (Howler.state !== 'running') {
        Howler.autoUnlock = true;
        Howler.autoSuspend = false; // Keep audio context alive
        console.log("Audio unlocked by user interaction.");

        // If a track was *supposed* to be playing, try to play it again.
        if (currentTrackName) {
            const trackToPlay = currentTrackName;
            currentTrackName = ""; 
            playMusic(trackToPlay);
        }
    } else {
        console.log("Audio already unlocked, no action needed.");
    }
}

/**
 * Fades one audio element in and plays it.
 * @param {Howl} player The Howl object to fade in
 */
function fadeIn(player) {
    // Play the track (Howler handles loading)

    // We set loop and volume before playing.
    player.loop(true);
    player.volume(0);
    player.play();
    
    // Fade from 0 to given volume over 2 seconds
    player.fade(0, 1, MUSIC_FADE_TIME);
}

/**
 * Fades one audio element out and stops it.
 * @param {Howl} player The Howl object to fade out
 */
function fadeOut(player) {
    if (!player) return;
    
    // Fade from current volume to 0 over 2 seconds
    player.fade(player.volume(), 0, MUSIC_FADE_TIME);
    
    // When the fade is done, stop and unload it
    player.once('fade', (fadeId) => {
        player.stop();
        player.unload(); // Unload the file from memory
    });
}

/**
 * Plays a new music track.
 * @param {string} trackFilename The name of the file (e.g., "Fading Light.mp3")
 */
export function playMusic(trackFilename) {

    // If no track is provided, or the track is already playing, do nothing.
    if (!trackFilename || trackFilename === currentTrackName) return;

    console.log(`AudioService: Playing track ${trackFilename}`);
    currentTrackName = trackFilename;

    // Create the new Howl object with the correct path
    const newPlayer = new Howl({
        src: [`/audio/${trackFilename}`],
        loop: true,
        volume: 0, // Start silent
        html5: true
    });

    // --- Crossfade Logic ---
    if (activePlayer === 'A') {
        // A is active, B is inactive
        fadeOut(playerA); // Fade out old track
        playerB = newPlayer; // Put new track in B
        fadeIn(playerB); // Fade in new track
        activePlayer = 'B'; // Make B the active player
    } else {
        // B is active, A is inactive
        fadeOut(playerB); // Fade out old track
        playerA = newPlayer; // Put new track in A
        fadeIn(playerA); // Fade in new track
        activePlayer = 'A'; // Make A the active player
    }
}

/**
 * Public function to set the master volume. This uses Howler's global volume setting.
 * @param {number} level A value between 0 (silent) and 0.3
 */
export function setMasterVolume(level) {
    // This sets the volume for ALL sounds managed by Howler.
    Howler.volume(level);
}

/**
 * Stop all music. Used for the Restart button.
 */
export function stopAllMusic() {
    fadeOut(playerA);
    fadeOut(playerB);
    playerA = null;
    playerB = null;
    currentTrackName = "";
}