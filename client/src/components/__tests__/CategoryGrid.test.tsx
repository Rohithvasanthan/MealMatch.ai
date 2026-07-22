import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CategoryGrid } from "@/components/CategoryGrid"

describe("CategoryGrid", () => {
  it("renders every popular category", () => {
    render(<CategoryGrid selectedCategory={null} onSelectCategory={vi.fn()} />)
    expect(screen.getByText("Biryani")).toBeInTheDocument()
    expect(screen.getByText("Pizza")).toBeInTheDocument()
    expect(screen.getByText("Burgers")).toBeInTheDocument()
  })

  it("calls onSelectCategory with the id and display name when tapped", () => {
    const onSelectCategory = vi.fn()
    render(<CategoryGrid selectedCategory={null} onSelectCategory={onSelectCategory} />)
    fireEvent.click(screen.getByText("Pizza"))
    expect(onSelectCategory).toHaveBeenCalledWith("pizza", "Pizza")
  })
})
