import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPWA } from "./pwa";
import { AuthProvider } from "./auth";
import SoundProvider from "./components/SoundProvider";
import { TickProvider } from "./clock/TickProvider";

initPWA();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <TickProvider>
        <SoundProvider>
          <App />
        </SoundProvider>
      </TickProvider>
    </AuthProvider>
  </React.StrictMode>
);
