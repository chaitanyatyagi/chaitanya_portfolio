import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Admin from './admin/Admin.jsx';
import './index.css';

// Tiny path-based routing: /admin serves the content manager, everything
// else serves the portfolio. (No router dependency needed for two pages.)
const isAdmin = window.location.pathname.startsWith('/admin');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? <Admin /> : <App />}
  </React.StrictMode>
);
