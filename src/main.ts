import './assets/styles/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { hydrateAppearanceModeFromStorage } from './services/appearance-runtime'
import { hydrateThemeTokensFromStorage } from './services/theme-runtime'

hydrateAppearanceModeFromStorage()
hydrateThemeTokensFromStorage()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
