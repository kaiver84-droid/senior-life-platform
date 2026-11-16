import { dbStatus } from "../../lib/db";
import type { DbEnv } from "../../lib/db";

type Ctx = { request: Request; env: DbEnv };

export const onRequestGet = async ({ env }: Ctx) =>
  new Response(
    JSON.stringify({
      ok: true,
      service: "senior-life-platform",
      time: new Date().toISOString(),
      ...dbStatus(env),
      features: [
        "fortune",
        "greeting-card",
        "quiz",
        "certificate",
        "ranking",
        "groups",
        "welfare",
        "magnifier",
        "family",
        "family-calendar",
        "local-news",
      ],
    }),
    { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }
  );
