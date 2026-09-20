import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json().catch(() => ({ action: "login" }));

    const response = NextResponse.json({
      success: true,
      message: action === "logout" ? "Guest demo session ended." : "Guest demo session activated.",
      redirect: action === "logout" ? "/login" : "/dashboard",
    });

    if (action === "logout") {
      response.cookies.delete("orbbit_guest_demo");
      response.cookies.delete("orbbit_guest_email");
    } else {
      // Set guest demo cookie for 7 days
      response.cookies.set("orbbit_guest_demo", "true", {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
        httpOnly: false, // accessible to client scripts if needed
      });
      response.cookies.set("orbbit_guest_email", "guest.reviewer@orbbit.ai", {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
        httpOnly: false,
      });
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to toggle demo session" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const url = new URL("/dashboard", request.url);
  const response = NextResponse.redirect(url);

  response.cookies.set("orbbit_guest_demo", "true", {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    httpOnly: false,
  });
  response.cookies.set("orbbit_guest_email", "guest.reviewer@orbbit.ai", {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    httpOnly: false,
  });

  return response;
}
