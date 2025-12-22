import React from 'react';
import ReactDOM from 'react-dom/client';
import "./styles/index.css"; // Tailwind
import "./i18n";
import App from "./app/app";

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

document.title = 'CoReTM 2.0';

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

