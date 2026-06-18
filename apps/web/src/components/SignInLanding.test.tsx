import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
vi.mock("@clerk/clerk-react", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
import { SignInLanding } from "./SignInLanding";

describe("SignInLanding", () => {
  it("shows the value prop and a sign-in action", () => {
    render(<SignInLanding />);
    expect(screen.getByText(/every application/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });
});
