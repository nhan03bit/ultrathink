import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const sql = getDb();

    const rangeParam = request.nextUrl.searchParams.get("range") ?? "7d";
    const daysMap: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[rangeParam] ?? 7;

    const [sessionResult, memoryResult, skillResult, hookResult, topSkills, recentActivity] = (await Promise.all([
      sql`SELECT COUNT(*) as count FROM sessions WHERE started_at > NOW() - INTERVAL '1 day' * ${days}`,
      sql`SELECT COUNT(*) as count FROM memories WHERE is_archived = false AND created_at > NOW() - INTERVAL '1 day' * ${days}`,
      sql`SELECT COUNT(*) as count FROM skill_usage WHERE invoked_at > NOW() - INTERVAL '1 day' * ${days}`,
      sql`SELECT COUNT(*) as count FROM hook_events WHERE created_at > NOW() - INTERVAL '1 day' * ${days}`,
      sql`SELECT skill_id, COUNT(*) as count FROM skill_usage WHERE invoked_at > NOW() - INTERVAL '1 day' * ${days} GROUP BY skill_id ORDER BY count DESC LIMIT 10`,
      sql`SELECT DATE(invoked_at) as date, COUNT(*) as count FROM skill_usage WHERE invoked_at > NOW() - INTERVAL '1 day' * ${days} GROUP BY DATE(invoked_at) ORDER BY date DESC`,
    ])) as Record<string, unknown>[][];
    const sessionCount = sessionResult[0];
    const memoryCount = memoryResult[0];
    const skillCount = skillResult[0];
    const hookCount = hookResult[0];

    return NextResponse.json({
      totals: {
        sessions: Number(sessionCount.count),
        memories: Number(memoryCount.count),
        skillInvocations: Number(skillCount.count),
        hookEvents: Number(hookCount.count),
      },
      topSkills,
      recentActivity,
    });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
