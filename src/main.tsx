import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPWA } from "./pwa";
import { AuthProvider } from "./auth/AuthProvider";

initPWA();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
