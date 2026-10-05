import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn(() => ({ auth: {} })));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

beforeEach(() => {
  vi.resetModules();
  createClient.mockClear();
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("Supabase client initialization", () => {
  it.each(["offline://disabled", "", "not-a-url", "ftp://example.test"])(
    "does not initialize a cloud client for %s",
    async (url) => {
      vi.stubEnv("VITE_SUPABASE_URL", url);
      vi.stubEnv("VITE_SUPABASE_ANON_KEY", "offline");
      const client = await import("./client");
      expect(client.isSupabaseConfigured).toBe(false);
      expect(client.supabase).toBeNull();
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it.each(["https://example.supabase.co", "http://127.0.0.1:54321"])(
    "initializes a configured cloud client at %s",
    async (url) => {
      vi.stubEnv("VITE_SUPABASE_URL", ` ${url} `);
      vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", " sb_publishable_test ");
      const client = await import("./client");
      expect(client.isSupabaseConfigured).toBe(true);
      expect(createClient).toHaveBeenCalledWith(url, "sb_publishable_test");
    },
  );

  it("requires a public key even with a valid URL", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    expect((await import("./client")).supabase).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("still rejects browser-exposed secret keys", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_secret_test");
    await expect(import("./client")).rejects.toThrow("service-role/secret key");
    expect(createClient).not.toHaveBeenCalled();
  });
});
