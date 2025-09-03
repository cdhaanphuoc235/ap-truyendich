// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./auth";
import AuthCallback from "./pages/AuthCallback";

const isCallback = window.location.pathname.startsWith("/auth/callback");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      {isCallback ? <AuthCallback /> : <App />}
    </AuthProvider>
  </React.StrictMode>
);
