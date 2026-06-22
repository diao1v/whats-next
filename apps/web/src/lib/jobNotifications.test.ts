import { describe, it, expect } from "vitest";
import { diffJobToasts, type JobLike } from "./jobNotifications";

const j = (over: Partial<JobLike>): JobLike =>
  ({ id: "j1", import_status: "ready", job_title: "Eng", company_name: "Acme", ...over });

describe("diffJobToasts", () => {
  it("toasts 'added' for a brand-new ready job (e.g. from the extension)", () => {
    const out = diffJobToasts(new Set(), new Map(), [j({ id: "new", import_status: "ready" })]);
    expect(out).toEqual([{ kind: "added", title: "Eng", company: "Acme" }]);
  });

  it("does not toast a brand-new still-importing job yet", () => {
    const out = diffJobToasts(new Set(), new Map(), [j({ id: "new", import_status: "importing" })]);
    expect(out).toEqual([]);
  });

  it("toasts 'added' when a known job goes importing -> ready", () => {
    const out = diffJobToasts(new Set(["j1"]), new Map([["j1", "importing"]]), [j({ import_status: "ready" })]);
    expect(out).toEqual([{ kind: "added", title: "Eng", company: "Acme" }]);
  });

  it("toasts 'failed' when a known job goes importing -> failed", () => {
    const out = diffJobToasts(new Set(["j1"]), new Map([["j1", "importing"]]), [j({ import_status: "failed" })]);
    expect(out).toEqual([{ kind: "failed" }]);
  });

  it("stays silent for a known, unchanged job (e.g. a restore reappearing)", () => {
    const out = diffJobToasts(new Set(["j1"]), new Map([["j1", "ready"]]), [j({ import_status: "ready" })]);
    expect(out).toEqual([]);
  });
});
