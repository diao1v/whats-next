import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { SignInLanding } from "./components/SignInLanding";
import "./index.css";

const queryClient = new QueryClient();
const pubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={pubKey}>
      <QueryClientProvider client={queryClient}>
        <SignedIn><App /></SignedIn>
        <SignedOut><SignInLanding /></SignedOut>
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>
);
