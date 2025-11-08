import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import './assets/themes.css'; // Import your main stylesheet

// 1. Create the Vue app instance
const app = createApp(App);

// 2. Create and use the Pinia store
app.use(createPinia());

// 3. Mount the app to the <div id="app"> in your index.html
app.mount('#app');