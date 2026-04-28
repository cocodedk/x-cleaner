import { describe, it, expect } from "vitest";
import { classifySignal, ErrorBudget } from "../src/errors.ts";

describe("classifySignal", () => {
  it("treats /i/flow/login redirect as fatal abort", () => {
    expect(classifySignal({ kind: "redirect", url: "https://x.com/i/flow/login" })).toEqual({
      action: "abort",
      reason: "login-required",
    });
  });

  it("treats /account/access redirect as fatal abort", () => {
    expect(classifySignal({ kind: "redirect", url: "https://x.com/account/access" })).toEqual({
      action: "abort",
      reason: "account-locked",
    });
  });

  it("treats HTTP 429 as a backoff signal", () => {
    expect(classifySignal({ kind: "http", status: 429 })).toEqual({
      action: "backoff",
      reason: "rate-limit",
    });
  });

  it("treats rate-limit toast text as a backoff signal", () => {
    const toast = { kind: "toast" as const, text: "Rate limit exceeded. Try again later." };
    expect(classifySignal(toast).action).toBe("backoff");
  });

  it("treats 'something went wrong' toast as a transient retry", () => {
    expect(
      classifySignal({ kind: "toast", text: "Something went wrong. Try again." }),
    ).toEqual({ action: "retry", reason: "transient" });
  });

  it("treats a 404 status as not-found (continue)", () => {
    expect(classifySignal({ kind: "http", status: 404 })).toEqual({
      action: "continue",
      reason: "not-found",
    });
  });

  it("treats a missing-selector signal as a continue-with-error", () => {
    expect(
      classifySignal({ kind: "selector-missing", selector: "[data-testid=caret]" }),
    ).toEqual({ action: "continue", reason: "selector-missing" });
  });

  it("treats unknown signals as a continue-with-error fallback", () => {
    // @ts-expect-error testing unknown shape
    expect(classifySignal({ kind: "weird" }).action).toBe("continue");
  });
});

describe("ErrorBudget", () => {
  it("counts consecutive errors and resets on success", () => {
    const budget = new ErrorBudget({ pauseAt: 3, abortAt: 10 });
    budget.recordError();
    budget.recordError();
    expect(budget.shouldPause()).toBe(false);
    budget.recordError();
    expect(budget.shouldPause()).toBe(true);
    budget.recordSuccess();
    expect(budget.shouldPause()).toBe(false);
  });

  it("flags abort when consecutive errors hit abortAt", () => {
    const budget = new ErrorBudget({ pauseAt: 3, abortAt: 5 });
    for (let i = 0; i < 4; i++) budget.recordError();
    expect(budget.shouldAbort()).toBe(false);
    budget.recordError();
    expect(budget.shouldAbort()).toBe(true);
  });

  it("rejects nonsensical config", () => {
    expect(() => new ErrorBudget({ pauseAt: 5, abortAt: 3 })).toThrow();
    expect(() => new ErrorBudget({ pauseAt: 0, abortAt: 5 })).toThrow();
  });
});
