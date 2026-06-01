import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("main.tsx: Entry point execution started");
createRoot(document.getElementById("root")!).render(<App />);
