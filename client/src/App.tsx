import { Badge } from "@/components/ui/badge"

function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold">MealMatch AI</h1>
          <Badge variant="secondary">Prototype scaffold</Badge>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-12">
        <p className="text-muted-foreground">
          Frontend foundation is wired up: Tailwind v4, shadcn/ui, Framer
          Motion, and React Query. Features land in later phases.
        </p>
      </main>
    </div>
  )
}

export default App
