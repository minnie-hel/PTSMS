import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from "./auth"
import { CompanyProvider } from "./company"
import { ThemeProvider } from "./theme"
import App from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <CompanyProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </CompanyProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
