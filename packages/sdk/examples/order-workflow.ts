import { z } from "zod";
import { Orbit } from "../src/index";

export const orbit = new Orbit({
  apiKey: process.env["ORBIT_API_KEY"] ?? "orb_example_key_12345",
  baseUrl: process.env["ORBIT_API_URL"] ?? "http://localhost:3000",
});

export const OrderInputSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  amount: z.number().positive(),
  items: z.array(z.string()).min(1),
});

export type OrderInput = z.infer<typeof OrderInputSchema>;

export interface OrderResult {
  orderId: string;
  paymentId: string;
  inventoryReserved: boolean;
  status: "COMPLETED";
}

/**
 * Order processing workflow demonstrating:
 * - Zod schema input validation
 * - Sequential durable steps (`step.run`)
 * - Side-effect idempotency (`context.idempotencyKey`)
 * - Saga compensation (`step.compensate`)
 * - Durable delay (`step.sleep`)
 */
export const orderWorkflow = orbit.workflow(
  {
    id: "process-order-flow",
    version: 1,
    name: "Customer Order Processing Flow",
    description: "Validates, reserves inventory, charges card, and sends confirmation",
    inputSchema: OrderInputSchema,
  },
  async ({ input, step, context }): Promise<OrderResult> => {
    // 1. Validate order details
    const validation = await step.run("validate-items", async () => {
      return { valid: true, itemCount: input.items.length };
    });

    // 2. Reserve inventory
    const reservation = await step.run("reserve-inventory", async () => {
      return { skuBatchId: `batch_${input.orderId}`, reserved: true };
    });

    // Register compensation in case subsequent steps fail
    step.compensate("release-inventory", async () => {
      console.log(`[Compensation] Releasing inventory batch ${reservation.skuBatchId}`);
    });

    // 3. Charge payment with retries & timeout
    const payment = await step.run(
      "charge-payment",
      async () => {
        // Stable idempotency key for external payment gateway (e.g. Stripe)
        const idempotencyKey = context.idempotencyKey;
        return {
          paymentId: `pay_${input.orderId}`,
          amount: input.amount,
          idempotencyKey,
        };
      },
      {
        retries: 3,
        timeout: "15s",
      }
    );

    // Register compensation to refund payment if confirmation fails
    step.compensate("refund-payment", async () => {
      console.log(`[Compensation] Refunding payment ${payment.paymentId}`);
    });

    // 4. Durable sleep before sending confirmation
    await step.sleep("delay-notification", "10ms");

    // 5. Send order confirmation
    await step.run("send-confirmation", async () => {
      return { sent: true, recipient: input.customerId };
    });

    return {
      orderId: input.orderId,
      paymentId: payment.paymentId,
      inventoryReserved: reservation.reserved,
      status: "COMPLETED",
    };
  }
);
