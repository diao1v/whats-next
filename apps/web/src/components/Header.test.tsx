import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
vi.mock("@clerk/clerk-react", () => ({ UserButton: () => <div data-testid="user-button" /> }));
import { Header } from "./Header";

describe("Header", () => {
  it("renders the app name, view toggle, and user button", () => {
    render(<Header />);
    expect(screen.getByText(/what's next/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /board/i })).toBeInTheDocument();
    expect(screen.getByTestId("user-button")).toBeInTheDocument();
  });
});
