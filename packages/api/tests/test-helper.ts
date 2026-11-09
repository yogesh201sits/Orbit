import {
  createClient,
  disconnect,
  PrismaTenantRepository,
  PrismaApiKeyRepository,
  type PrismaClient,
} from "@durable/storage";
import { AuthService } from "../src/services/auth.service";
import { createApp } from "../src/app";

export const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:1234@localhost:5432/orbit_test?schema=public";

export interface TestTenantFixture {
  readonly tenantId: string;
  readonly apiKeyRecord: any;
  readonly plainTextKey: string;
  readonly headers: Record<string, string>;
}

export function getTestClient(): PrismaClient {
  return createClient(DATABASE_URL);
}

export async function cleanupTestClient(client: PrismaClient): Promise<void> {
  try {
    await client.apiKey.deleteMany();
    await client.workflowSchedule.deleteMany();
    await client.outboxEvent.deleteMany();
    await client.workflowEvent.deleteMany();
    await client.workflowStep.deleteMany();
    await client.workflowRun.deleteMany();
    await client.workflowVersion.deleteMany();
    await client.workflow.deleteMany();
    await client.job.deleteMany();
    await client.worker.deleteMany();
    await client.tenant.deleteMany();
  } catch {
    // ignore cleanup errors on shutdown
  }
  await disconnect(client);
}

export async function createTestTenantAndKey(
  client: PrismaClient,
  namePrefix = "test"
): Promise<TestTenantFixture> {
  const tenantRepo = new PrismaTenantRepository(client);
  const apiKeyRepo = new PrismaApiKeyRepository(client);
  const authService = new AuthService(apiKeyRepo);

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const slug = `${namePrefix}-${timestamp}-${randomSuffix}`;

  const tenant = await tenantRepo.create({
    name: `Tenant ${slug}`,
    slug,
  });

  const { apiKey, plainTextKey } = await authService.createApiKey(
    tenant.id,
    "Default Test Key"
  );

  return {
    tenantId: tenant.id,
    apiKeyRecord: apiKey,
    plainTextKey,
    headers: {
      Authorization: `Bearer ${plainTextKey}`,
      "Content-Type": "application/json",
    },
  };
}

export function createTestApp(client: PrismaClient) {
  return createApp({ client });
}
