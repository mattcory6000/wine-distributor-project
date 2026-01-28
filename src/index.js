import React from 'react';
import ReactDOM from 'react-dom/client';
import WineDistributorApp from './wine-distributor-app';

// window.storage polyfill for localStorage and Backend persistence
const API_URL = 'http://localhost:3001/api/storage';

window.storage = {
    get: async (key) => {
        try {
            const response = await fetch(`${API_URL}/${key}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn(`Backend fetch failed for ${key}, falling back to localStorage`);
        }

        // Fallback to localStorage
        const value = localStorage.getItem(key);
        return value ? { value } : null;
    },
    set: async (key, value) => {
        // Try to save to backend
        try {
            await fetch(`${API_URL}/${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value })
            });
        } catch (error) {
            console.warn(`Backend save failed for ${key}, using localStorage only`);
        }

        // Always set in localStorage as well for redundancy
        localStorage.setItem(key, value);
    },
    delete: async (key) => {
        try {
            await fetch(`${API_URL}/${key}`, { method: 'DELETE' });
        } catch (error) {
            console.warn(`Backend delete failed for ${key}`);
        }
        localStorage.removeItem(key);
    }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <WineDistributorApp />
    </React.StrictMode>
);
