import { z } from "zod";
import { Orbit } from "../src/index";

export const orbit = new Orbit({
  apiKey: process.env["ORBIT_API_KEY"] ?? "orb_example_key_12345",
  baseUrl: process.env["ORBIT_API_URL"] ?? "http://localhost:3000",
});

export const UserPipelineInputSchema = z.object({
  userId: z.string(),
  enrichPreferences: z.boolean().default(true),
});

export interface UserSummary {
  profile: { id: string; name: string; email: string };
  metrics: { loginCount: number; lastActive: string };
  preferences?: { theme: string; notifications: boolean } | undefined;
}

/**
 * Demonstrates:
 * - `step.parallel()` running concurrent tasks with typed tuple returns
 * - Strongly-typed step executions
 */
export const userEnrichmentWorkflow = orbit.workflow(
  {
    id: "user-enrichment-pipeline",
    version: 1,
    name: "User Data Enrichment Pipeline",
    inputSchema: UserPipelineInputSchema,
  },
  async ({ input, step }): Promise<UserSummary> => {
    // Execute multiple independent fetches in parallel
    const [profile, metrics] = await step.parallel([
      () =>
        step.run("fetch-profile", async () => {
          return {
            id: input.userId,
            name: "Jane Doe",
            email: "jane.doe@example.com",
          };
        }),
      () =>
        step.run("fetch-metrics", async () => {
          return {
            loginCount: 42,
            lastActive: new Date().toISOString(),
          };
        }),
    ]);

    let preferences: { theme: string; notifications: boolean } | undefined;

    if (input.enrichPreferences) {
      preferences = await step.run("fetch-preferences", async () => {
        return {
          theme: "dark",
          notifications: true,
        };
      });
    }

    return {
      profile,
      metrics,
      preferences,
    };
  }
);
