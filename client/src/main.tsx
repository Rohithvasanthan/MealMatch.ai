import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MotionConfig } from "framer-motion"
import { LocationProvider } from "@/lib/locationStore"
import { ThemeProvider } from "@/lib/themeStore"
import "./index.css"
import App from "./App.tsx"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <LocationProvider>
            <App />
          </LocationProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
)
