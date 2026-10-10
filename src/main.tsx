import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ResourceSetup from './ResourceSetup'
import './style.css'
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ResourceSetup><App/></ResourceSetup></React.StrictMode>)
