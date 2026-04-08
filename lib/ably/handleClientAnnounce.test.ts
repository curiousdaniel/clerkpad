import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleAblyAnnounceMessage } from "./handleClientAnnounce";

const sessionMem: Record<string, string> = {};

describe("handleAblyAnnounceMessage", () => {
  beforeEach(() => {
    for (const k of Object.keys(sessionMem)) delete sessionMem[k];
    vi.stubGlobal(
      "sessionStorage",
      {
        getItem: (k: string) => sessionMem[k] ?? null,
        setItem: (k: string, v: string) => {
          sessionMem[k] = v;
        },
        removeItem: (k: string) => {
          delete sessionMem[k];
        },
        clear: () => {
          for (const k of Object.keys(sessionMem)) delete sessionMem[k];
        },
        key: () => null,
        get length() {
          return Object.keys(sessionMem).length;
        },
      } as Storage
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores invalid payloads", () => {
    const showToast = vi.fn();
    handleAblyAnnounceMessage(null, showToast);
    handleAblyAnnounceMessage({}, showToast);
    handleAblyAnnounceMessage({ id: "", body: "x" }, showToast);
    handleAblyAnnounceMessage({ id: "a", body: "" }, showToast);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("shows info toast and stores dedupe key", () => {
    const showToast = vi.fn();
    handleAblyAnnounceMessage(
      { id: "a1", body: "Hello", severity: "info" },
      showToast
    );
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast.mock.calls[0][0]).toMatchObject({
      kind: "info",
      message: "Hello",
    });
    expect(sessionStorage.getItem("clerkbid_announce_seen:a1")).toBe("1");
  });

  it("does not show twice for the same id", () => {
    const showToast = vi.fn();
    handleAblyAnnounceMessage({ id: "x", body: "Hi" }, showToast);
    handleAblyAnnounceMessage({ id: "x", body: "Hi again" }, showToast);
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("joins title and body", () => {
    const showToast = vi.fn();
    handleAblyAnnounceMessage(
      { id: "t", title: "Title", body: "Body" },
      showToast
    );
    expect(showToast.mock.calls[0][0].message).toBe("Title\n\nBody");
  });

  it("maps warning severity", () => {
    const showToast = vi.fn();
    handleAblyAnnounceMessage(
      { id: "w", body: "Careful", severity: "warning" },
      showToast
    );
    expect(showToast.mock.calls[0][0].kind).toBe("warning");
  });
});
