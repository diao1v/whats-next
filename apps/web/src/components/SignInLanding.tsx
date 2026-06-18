import { SignInButton } from "@clerk/clerk-react";

export function SignInLanding() {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="flex flex-col justify-center gap-4 bg-gradient-to-br from-[#fbe7c6] to-[#fdf3e3] p-10">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-extrabold text-paper">W</span>
          <span className="text-lg font-extrabold text-ink">What&apos;s Next</span>
        </div>
        <h2 className="text-2xl font-extrabold leading-snug text-ink">Every application,<br />one calm place.</h2>
        <ul className="space-y-1.5 text-sm text-[#7c5e3b]">
          <li>• Paste a URL — we extract the details</li>
          <li>• Track stages from Saved to Offer</li>
          <li>• See salary, skills &amp; next steps at a glance</li>
        </ul>
      </div>
      <div className="flex items-center justify-center bg-paper p-10">
        <div className="text-center">
          <p className="text-lg font-bold text-ink">Welcome</p>
          <p className="mt-1 text-sm text-muted">Sign in to continue</p>
          <div className="mt-5">
            <SignInButton mode="modal">
              <button className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-paper">
                Continue with Google
              </button>
            </SignInButton>
          </div>
        </div>
      </div>
    </div>
  );
}
