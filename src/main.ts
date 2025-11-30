import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { inject } from '@vercel/analytics'
import './style.css'
import App from './App.vue'

// Initialize Vercel Analytics
inject()

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
