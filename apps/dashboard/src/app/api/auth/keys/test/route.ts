import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Orbit, AuthenticationError } from "@durable/sdk";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, verified: false, message: "Unauthorized: Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { apiKey, baseUrl } = body;

    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json(
        { success: false, verified: false, message: "Missing or invalid API key string" },
        { status: 400 }
      );
    }

    const trimmedKey = apiKey.trim();
    const targetUrl = baseUrl || process.env.ORBIT_API_URL || "http://localhost:3001";

    const orbit = new Orbit({
      apiKey: trimmedKey,
      baseUrl: targetUrl,
      timeoutMs: 4000,
    });

    try {
      const list = await orbit.workflows.list({ limit: 1 });
      return NextResponse.json({
        success: true,
        verified: true,
        keyPrefix: trimmedKey.slice(0, 14),
        targetUrl,
        sdkVersion: "@durable/sdk@0.1.0",
        liveConnection: true,
        workflowsCount: list.workflows.length,
        timestamp: new Date().toISOString(),
        message: "SDK Handshake verified successfully with Orbit Control Plane",
      });
    } catch (err: any) {
      if (
        err instanceof AuthenticationError ||
        err?.statusCode === 401 ||
        err?.code === "UNAUTHORIZED" ||
        err?.message?.includes("401") ||
        err?.message?.includes("Invalid, revoked, or expired")
      ) {
        return NextResponse.json(
          {
            success: false,
            verified: false,
            keyPrefix: trimmedKey.slice(0, 14),
            targetUrl,
            message: "Authentication failed: Invalid, revoked, or expired API key (401 Unauthorized)",
          },
          { status: 401 }
        );
      }

      const isConnRefused =
        err?.name === "NetworkError" ||
        err?.message?.includes("fetch failed") ||
        err?.message?.includes("ECONNREFUSED");

      return NextResponse.json(
        {
          success: false,
          verified: false,
          keyPrefix: trimmedKey.slice(0, 14),
          targetUrl,
          message: isConnRefused
            ? `Connection refused at ${targetUrl}. Start the Orbit API server with 'bun --cwd packages/api dev'.`
            : `SDK Handshake error: ${err?.message || "Unknown communication failure"}`,
        },
        { status: 502 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, verified: false, message: err?.message || "SDK validation error" },
      { status: 500 }
    );
  }
}
