import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Check for corrupted state on app initialization
function checkAndClearCorruptedState() {
  try {
    // Check if there's a version mismatch or corrupted data
    const appVersion = '1.0.1' // Increment this when you need to force clear storage
    const storedVersion = localStorage.getItem('app-version')
    
    if (storedVersion !== appVersion) {
      console.log('🔄 App version changed, clearing old storage...')
      
      // Clear all localStorage except specific keys we want to keep
      const keysToKeep = ['app-version']
      const allKeys: string[] = []
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && !keysToKeep.includes(key)) {
          allKeys.push(key)
        }
      }
      
      allKeys.forEach(key => localStorage.removeItem(key))
      sessionStorage.clear()
      
      // Set new version
      localStorage.setItem('app-version', appVersion)
      console.log('✅ Storage cleared for new version')
    }
    
    // Also check for hanging auth states
    const hasSupabaseKeys = Object.keys(localStorage).some(key => 
      key.includes('supabase') && localStorage.getItem(key)?.includes('error')
    )
    
    if (hasSupabaseKeys) {
      console.log('🚨 Detected potentially corrupted auth state, clearing...')
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase')) {
          localStorage.removeItem(key)
        }
      })
    }
  } catch (err) {
    console.error('Error checking app state:', err)
  }
}

// Run cleanup before mounting app
checkAndClearCorruptedState()

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
