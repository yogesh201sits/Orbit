import { describe, test, expect } from "bun:test";
import { Orbit } from "../../src/client/orbit";
import { ConfigurationError } from "../../src/errors/sdk-errors";
import { redactSecret } from "../../src/client/config";

describe("Orbit Client & Configuration", () => {
  test("initializes successfully with explicit API key and baseUrl", () => {
    const orbit = new Orbit({
      apiKey: "orb_test_secret_key_12345",
      baseUrl: "https://api.orbit.dev",
      timeoutMs: 15_000,
    });

    expect(orbit.config.apiKey).toBe("orb_test_secret_key_12345");
    expect(orbit.config.baseUrl).toBe("https://api.orbit.dev");
    expect(orbit.config.timeoutMs).toBe(15_000);
    expect(orbit.runs).toBeDefined();
    expect(orbit.workflows).toBeDefined();
    expect(orbit.schedules).toBeDefined();
  });

  test("reads apiKey and baseUrl from environment variables if omitted", () => {
    const origKey = process.env["ORBIT_API_KEY"];
    const origUrl = process.env["ORBIT_API_URL"];

    process.env["ORBIT_API_KEY"] = "orb_env_key_999";
    process.env["ORBIT_API_URL"] = "http://env-host:4000";

    try {
      const orbit = new Orbit();
      expect(orbit.config.apiKey).toBe("orb_env_key_999");
      expect(orbit.config.baseUrl).toBe("http://env-host:4000");
    } finally {
      if (origKey !== undefined) {
        process.env["ORBIT_API_KEY"] = origKey;
      } else {
        delete process.env["ORBIT_API_KEY"];
      }
      if (origUrl !== undefined) {
        process.env["ORBIT_API_URL"] = origUrl;
      } else {
        delete process.env["ORBIT_API_URL"];
      }
    }
  });

  test("throws ConfigurationError when API key is missing", () => {
    const origKey = process.env["ORBIT_API_KEY"];
    delete process.env["ORBIT_API_KEY"];

    try {
      expect(() => new Orbit()).toThrow(ConfigurationError);
      expect(() => new Orbit({ apiKey: "   " })).toThrow(ConfigurationError);
    } finally {
      process.env["ORBIT_API_KEY"] = origKey;
    }
  });

  test("throws ConfigurationError on invalid baseUrl format", () => {
    expect(
      () =>
        new Orbit({
          apiKey: "valid-key",
          baseUrl: "not-a-valid-url",
        })
    ).toThrow(ConfigurationError);
  });

  test("redacts sensitive API keys in logs and representations", () => {
    expect(redactSecret("orb_live_abcdef1234567890")).toBe("orb_...7890");
    expect(redactSecret("short")).toBe("***");
    expect(redactSecret("")).toBe("");
    expect(redactSecret(null)).toBe("");
  });

  test("orbit.workflow registers in the instance's registry", () => {
    const orbit = new Orbit({ apiKey: "test-key" });

    const wf = orbit.workflow(
      { id: "my-flow", version: 1 },
      async () => "result"
    );

    expect(orbit.registry.has("my-flow")).toBe(true);
    expect(orbit.registry.get("my-flow")).toBe(wf);
  });
});
