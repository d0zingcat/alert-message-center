import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import AuthCallback from "./views/AuthCallback.tsx";
import "./index.css";

// Simple routing based on pathname
const pathname = window.location.pathname;

const rootElement = document.getElementById("root");
if (rootElement) {
	ReactDOM.createRoot(rootElement).render(
		<React.StrictMode>
			<AuthProvider>
				{pathname === "/auth/callback" ? <AuthCallback /> : <App />}
			</AuthProvider>
		</React.StrictMode>,
	);
}
