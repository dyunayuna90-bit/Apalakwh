import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// Import SEMUA komponen M3E di sini biar ke-load
import '@m3e/all'; 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
