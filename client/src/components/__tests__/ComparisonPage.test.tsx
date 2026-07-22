import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ComparisonPage } from "@/components/ComparisonPage"
import { ThemeProvider } from "@/lib/themeStore"
import type { ComparisonResult } from "@/types/api"
import type { ReactElement } from "react"

function renderWithProviders(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe("ComparisonPage", () => {
  it("shows a loading state while fetching", () => {
    renderWithProviders(<ComparisonPage result={null} loading isError={false} onBack={vi.fn()} onRetry={vi.fn()} />)
    expect(screen.getByText(/Checking your location/)).toBeInTheDocument()
  })

  it("shows a retryable error when the request fails outright", () => {
    const onRetry = vi.fn()
    renderWithProviders(<ComparisonPage result={null} loading={false} isError onBack={vi.fn()} onRetry={onRetry} />)

    expect(screen.getByText("Couldn't reach the comparison service.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("shows an all-platforms-failed state without crashing when bestDeal is null", () => {
    const data: ComparisonResult = {
      query: "biryani",
      lat: 12.9352,
      lng: 77.6146,
      cached: false,
      timestamp: "2026-01-01T00:00:00.000Z",
      bestDeal: null,
      results: [
        { platform: "swiggy", availability: "error", items: [], errorMessage: "Swiggy unavailable" },
        { platform: "zomato", availability: "error", items: [], errorMessage: "Zomato unavailable" },
      ],
    }
    renderWithProviders(<ComparisonPage result={data} loading={false} isError={false} onBack={vi.fn()} onRetry={vi.fn()} />)

    expect(screen.getByText("All platforms failed to respond right now.")).toBeInTheDocument()
  })

  it("renders a partial-failure result: winner highlighted, failed platform shows its own message", () => {
    const data: ComparisonResult = {
      query: "biryani",
      lat: 12.9352,
      lng: 77.6146,
      cached: false,
      timestamp: "2026-01-01T00:00:00.000Z",
      bestDeal: { winner: "swiggy", reasoning: "Only Swiggy has this item available" },
      results: [
        {
          platform: "swiggy",
          availability: "available",
          items: [
            {
              id: "1",
              name: "Chicken Biryani",
              restaurantName: "Meghana Foods",
              restaurantId: "r1",
              price: 375,
            },
          ],
        },
        {
          platform: "zomato",
          availability: "error",
          items: [],
          errorMessage: "Could not reach Zomato",
        },
      ],
    }
    renderWithProviders(<ComparisonPage result={data} loading={false} isError={false} onBack={vi.fn()} onRetry={vi.fn()} />)

    expect(screen.getByText(/Best Deal Found/)).toBeInTheDocument()
    expect(screen.getByText("Only Swiggy has this item available")).toBeInTheDocument()
    expect(screen.getByText("Chicken Biryani")).toBeInTheDocument()
    expect(screen.getByText("Cheapest deal")).toBeInTheDocument()

    // The failed platform must show a clean, generic message — never the raw scraper/network error.
    expect(screen.getByText("Currently Unavailable")).toBeInTheDocument()
    expect(screen.queryByText("Could not reach Zomato")).not.toBeInTheDocument()

    // It's grouped under an "Unavailable" section, separate from working providers.
    expect(screen.getByText("Unavailable")).toBeInTheDocument()
  })

  it("never renders a raw technical error message, regardless of error code", () => {
    const data: ComparisonResult = {
      query: "milk",
      lat: 12.9352,
      lng: 77.6146,
      cached: false,
      timestamp: "2026-01-01T00:00:00.000Z",
      bestDeal: null,
      results: [
        {
          platform: "swiggy",
          availability: "available",
          items: [{ id: "1", name: "Milk", restaurantName: "Store", restaurantId: "r1", price: 30 }],
        },
        {
          platform: "zomato",
          availability: "error",
          items: [],
          errorCode: "BLOCKED",
          errorMessage: "Page.goto: net::ERR_HTTP2_PROTOCOL_ERROR at https://www.zomato.com/",
        },
      ],
    }
    renderWithProviders(<ComparisonPage result={data} loading={false} isError={false} onBack={vi.fn()} onRetry={vi.fn()} />)

    expect(screen.getByText("Currently Unavailable")).toBeInTheDocument()
    expect(screen.queryByText(/ERR_HTTP2/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Page\.goto/)).not.toBeInTheDocument()
  })

  it("disables the Open action with an explanatory tooltip when no deep link is available, but keeps it enabled when one exists", () => {
    const data: ComparisonResult = {
      query: "milk",
      lat: 12.9352,
      lng: 77.6146,
      cached: false,
      timestamp: "2026-01-01T00:00:00.000Z",
      bestDeal: null,
      results: [
        {
          platform: "swiggy",
          availability: "available",
          items: [
            {
              id: "1",
              name: "No Link Item",
              restaurantName: "Store A",
              restaurantId: "r1",
              price: 30,
              // no itemUrl
            },
            {
              id: "2",
              name: "Linked Item",
              restaurantName: "Store B",
              restaurantId: "r2",
              price: 40,
              itemUrl: "https://blinkit.com/prn/linked-item/prid/2",
            },
          ],
        },
      ],
    }
    renderWithProviders(<ComparisonPage result={data} loading={false} isError={false} onBack={vi.fn()} onRetry={vi.fn()} />)

    const noLinkRow = screen.getByText("No Link Item").closest("div")!
    const disabledOpen = noLinkRow.parentElement!.querySelector('[aria-disabled="true"]')
    expect(disabledOpen).not.toBeNull()
    expect(disabledOpen).toHaveAttribute("title", "Exact product page unavailable.")

    const linkedRow = screen.getByText("Linked Item").closest("a")
    expect(linkedRow).toHaveAttribute("href", "https://blinkit.com/prn/linked-item/prid/2")
    expect(linkedRow).toHaveAttribute("target", "_blank")
  })

  it("calls onBack when the back button is clicked", () => {
    const onBack = vi.fn()
    const data: ComparisonResult = {
      query: "pizza",
      lat: 12.9352,
      lng: 77.6146,
      cached: false,
      timestamp: "2026-01-01T00:00:00.000Z",
      bestDeal: null,
      results: [{ platform: "swiggy", availability: "available", items: [] }],
    }
    renderWithProviders(<ComparisonPage result={data} loading={false} isError={false} onBack={onBack} onRetry={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: /Back to search/ }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
