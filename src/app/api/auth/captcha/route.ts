import { NextResponse } from "next/server";
import { createCaptchaChallenge } from "@/lib/captcha";

export async function GET() {
  try {
    const challenge = await createCaptchaChallenge();
    return NextResponse.json(challenge);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not create verification" },
      { status: 500 }
    );
  }
}
