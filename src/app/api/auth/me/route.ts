import { getSession } from "@/lib/auth";
import { json } from "@/lib/api";

export async function GET() {
  try {
    const session = await getSession();
    return json({ user: session });
  } catch (err) {
    console.error("[api/auth/me] unexpected error:", err);
    return json({ user: null }, 500);
  }
}
