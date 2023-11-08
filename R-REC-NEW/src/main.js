import { createApp } from 'vue'
import App from './App.vue'
import Navigation from './components/Navigation.vue'
import 'chart.js'
import 'vue-chartjs'

const app = createApp(App);

app.component('Navigation', Navigation);
app.mount('#app');

// createApp(App).mount('#app')
