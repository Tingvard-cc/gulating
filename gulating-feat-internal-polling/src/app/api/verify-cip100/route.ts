import { NextResponse } from "next/server";
import { verifyCIP100Metadata } from "@/lib/cip100Verification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { metadata } = await request.json();

    if (!metadata) {
      return NextResponse.json(
        { error: "Missing metadata parameter" },
        { status: 400 }
      );
    }

    const verificationResult = await verifyCIP100Metadata(metadata);
    return NextResponse.json(verificationResult);
  } catch (error) {
    console.error("CIP-100 verification error:", error);
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json(
      {
        error: "Verification failed",
        details: message,
      },
      { status: 500 }
    );
  }
}
