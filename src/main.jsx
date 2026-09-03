import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from './contexts/WebMCPContext'
import App from './App'
import './index.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <Provider>
        <App />
      </Provider>
    </React.StrictMode>,
  )
}
