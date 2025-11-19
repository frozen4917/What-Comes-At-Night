/**
 * @file audioService.js
 * @description Audio System Wrapper.
 * A service layer over Howler.js to manage game audio.
 * It handles:
 * - Preloading and playing music tracks.
 * - Managing crossfades between phases.
 * - Global volume control.
 * - Unlocking audio contexts for browsers.
 */

import { Howl, Howler } from 'howler';

// --- Audio Configuration ---
const MUSIC_FADE_TIME = 2000; // 2 seconds for fade in/out
let currentTrackName = ""; // The File Name of the track that is playing

let playerA = null, playerB = null; // 2 Players to allow for crossfading
let activePlayer = 'A'; // Tracks which player is currently active

/**
 * Unlocks the browser's audio context on the first user interaction. Resumes/Replays track if required.
 */
export function unlockAudio() {
    if (Howler.state !== 'running') {
        // --- Howler.state is suspended ---
        Howler.autoUnlock = true;
        Howler.autoSuspend = false; // Keep audio context alive

        // If a track was *supposed* to be playing, try to play it again.
        if (currentTrackName) {
            const trackToPlay = currentTrackName;
            currentTrackName = ""; 
            playMusic(trackToPlay);
        }
    }
}

/**
 * Fades one audio element in and plays it.
 * @param {Howl} player The Howl object to fade in
 */
function fadeIn(player) {
    // Set loop and volume before playing.
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
 * Plays a specific music track by file name and handles crossfading.
 * @param {string} trackFilename The file name of the track to play (e.g., "Fading Light.mp3").
 */
export function playMusic(trackFilename) {

    // If no track is provided, or the track is already playing, do nothing.
    if (!trackFilename || trackFilename === currentTrackName) return;

    currentTrackName = trackFilename; // Set the current track to the file name

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
 * Sets the global master volume for all audio managed by Howler.
 * @param {number} level The volume level from 0.0 (mute) to 1.0 (max).
 */
export function setMasterVolume(level) {
    // This sets the volume for ALL sounds managed by Howler.
    Howler.volume(level);
}

/**
 * Stops all currently playing music and resets the audio state. Used when restarting the game to ensure silence before reload.
 */
export function stopAllMusic() {
    fadeOut(playerA);
    fadeOut(playerB);
    playerA = null;
    playerB = null;
    currentTrackName = "";
}