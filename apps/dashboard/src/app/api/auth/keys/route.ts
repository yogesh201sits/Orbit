import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/lib/api/client";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { name, expiresAt } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Key name is required" }, { status: 400 });
    }

    const res = await api.createApiKey(name, expiresAt);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create API key" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized: Authentication required" }, { status: 401 });
    }

    const res = await api.listApiKeys();
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to list API keys" },
      { status: 500 }
    );
  }
}
