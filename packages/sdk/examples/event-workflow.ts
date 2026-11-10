import { z } from "zod";
import { Orbit } from "../src/index";

export const orbit = new Orbit({
  apiKey: process.env["ORBIT_API_KEY"] ?? "orb_example_key_12345",
  baseUrl: process.env["ORBIT_API_URL"] ?? "http://localhost:3000",
});

const ChildTaskSchema = z.object({
  taskId: z.string(),
  multiplier: z.number(),
});

export const childComputationWorkflow = orbit.workflow(
  {
    id: "child-computation",
    version: 1,
    inputSchema: ChildTaskSchema,
  },
  async ({ input, step }) => {
    return await step.run("compute", () => {
      return { result: input.multiplier * 100, completedAt: new Date().toISOString() };
    });
  }
);

export const EventWorkflowInputSchema = z.object({
  requestId: z.string(),
  managerEmail: z.string().email(),
});

/**
 * Demonstrates:
 * - `step.waitForEvent()` waiting for external approval
 * - `step.emit()` publishing domain events
 * - `step.child()` composing sub-workflows
 */
export const approvalWorkflow = orbit.workflow(
  {
    id: "approval-workflow",
    version: 1,
    name: "Manager Approval Flow",
    inputSchema: EventWorkflowInputSchema,
  },
  async ({ input, step }) => {
    // 1. Emit notification event requesting approval
    await step.emit(
      "approval.requested",
      {
        requestId: input.requestId,
        managerEmail: input.managerEmail,
      },
      { correlationKey: input.requestId }
    );

    // 2. Wait for external approval event
    const approval = await step.waitForEvent<{ approved: boolean; approver: string }>(
      "wait-for-decision",
      {
        event: "approval.decided",
        timeout: "24h",
        correlationKey: input.requestId,
      }
    );

    // 3. Delegate calculation to a child workflow
    const computed = await step.child(
      "run-calculation",
      childComputationWorkflow,
      {
        taskId: input.requestId,
        multiplier: 5,
      }
    );

    return {
      requestId: input.requestId,
      approved: approval.approved,
      score: computed.result,
      status: "APPROVED_AND_COMPUTED",
    };
  }
);
