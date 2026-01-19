import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// Gak perlu import @m3e lagi di sini karena udah di index.html
// import '@m3e/all';  <-- INI YANG BIKIN ERROR TADI, KITA BUANG

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
