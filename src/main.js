/**
 * @file main.js
 * @description Vue application entry point
 * 
 * This file bootstraps the Vue 3 application with necessary plugins and mounts it to the DOM. It's the first JavaScript file executed  after the browser loads index.html.
 * 
 * Initialization Flow:
 * 1. Create Vue app instance from root component (App.vue)
 * 2. Register Pinia store plugin (for reactive state management)
 * 3. Mount app to <div id="app"> in index.html
 * 
 * Build Process:
 * Vite uses this as the entry point for bundling. The path is specified in index.html as:
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import './assets/main.css'; // Global styles (themes, layout, components)

// --- APPLICATION INITIALIZATION ---

/**
 * 1. Create the Vue application instance.
 * App.vue serves as the root component, containing the entire game UI.
 */
const app = createApp(App);

/**
 * 2. Install Pinia state management plugin.
 * This enables all components to access gameStore via useGameStore().
 */
app.use(createPinia());

/**
 * 3. Mount application to DOM.
 * Finds <div id="app"> in index.html and replaces it with rendered Vue app.
 * This is the final step - after this line, the game is live in the browser.
 */
app.mount('#app');