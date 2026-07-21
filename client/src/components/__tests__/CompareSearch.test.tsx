import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CompareSearch } from "@/components/CompareSearch"
import { useCompare } from "@/hooks/useMealMatchQueries"
import type { ComparisonResult } from "@/types/api"

vi.mock("@/hooks/useMealMatchQueries", () => ({ useCompare: vi.fn() }))

const mockedUseCompare = vi.mocked(useCompare)
const COORDS = { lat: 12.9352, lng: 77.6146 }

function baseQueryResult(overrides: Partial<ReturnType<typeof useCompare>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useCompare>
}

async function typeAndSettle(query: string) {
  const input = screen.getByPlaceholderText("Search for a dish, e.g. biryani")
  fireEvent.change(input, { target: { value: query } })
  // CompareSearch debounces the query by 500ms before it's considered "searching".
  await waitFor(() => expect(mockedUseCompare).toHaveBeenLastCalledWith(COORDS, query), {
    timeout: 1000,
  })
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("CompareSearch", () => {
  it("prompts for a location when coords are unset", () => {
    mockedUseCompare.mockReturnValue(baseQueryResult())
    render(<CompareSearch coords={null} />)
    expect(screen.getByText("Set your location above to start comparing.")).toBeInTheDocument()
  })

  it("shows an idle prompt before the user types", () => {
    mockedUseCompare.mockReturnValue(baseQueryResult())
    render(<CompareSearch coords={COORDS} />)
    expect(
      screen.getByText("Start typing to compare live prices from Swiggy and Zomato."),
    ).toBeInTheDocument()
  })

  it("shows a loading state while fetching", async () => {
    mockedUseCompare.mockReturnValue(baseQueryResult({ isLoading: true, isFetching: true }))
    render(<CompareSearch coords={COORDS} />)
    await typeAndSettle("biryani")
    expect(screen.getByText(/Fetching live prices/)).toBeInTheDocument()
  })

  it("shows a retryable error when the request fails outright", async () => {
    const refetch = vi.fn()
    mockedUseCompare.mockReturnValue(baseQueryResult({ isError: true, refetch }))
    render(<CompareSearch coords={COORDS} />)
    await typeAndSettle("biryani")

    expect(screen.getByText("Couldn't reach the comparison service.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it("shows a both-platforms-failed state without crashing when bestDeal is null", async () => {
    const data: ComparisonResult = {
      query: "biryani",
      lat: COORDS.lat,
      lng: COORDS.lng,
      cached: false,
      timestamp: "2026-01-01T00:00:00.000Z",
      bestDeal: null,
      results: [
        { platform: "swiggy", availability: "error", items: [], errorMessage: "Swiggy unavailable" },
        { platform: "zomato", availability: "error", items: [], errorMessage: "Zomato unavailable" },
      ],
    }
    mockedUseCompare.mockReturnValue(baseQueryResult({ data }))
    render(<CompareSearch coords={COORDS} />)
    await typeAndSettle("biryani")

    expect(
      screen.getByText("Both Swiggy and Zomato failed to respond right now. Please try again shortly."),
    ).toBeInTheDocument()
  })

  it("renders a partial-failure result: winner highlighted, failed platform shows its own message", async () => {
    const data: ComparisonResult = {
      query: "biryani",
      lat: COORDS.lat,
      lng: COORDS.lng,
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
    mockedUseCompare.mockReturnValue(baseQueryResult({ data }))
    render(<CompareSearch coords={COORDS} />)
    await typeAndSettle("biryani")

    expect(screen.getByText(/is the best deal/)).toBeInTheDocument()
    expect(screen.getByText("Chicken Biryani")).toBeInTheDocument()
    expect(screen.getByText("Could not reach Zomato")).toBeInTheDocument()
  })
})
