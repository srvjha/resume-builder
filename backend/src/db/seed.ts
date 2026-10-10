import { sql } from "drizzle-orm";
import { templates as templateDefinitions } from "../templates/index.js";
import { db, pool } from "./index.js";
import { templates } from "./schema/index.js";

// Syncs template metadata from code into the database. Safe to run on every deploy.
await db
  .insert(templates)
  .values(
    templateDefinitions.map(({ id, name, description, atsSafe, version }) => ({
      id,
      name,
      description,
      atsSafe,
      version,
      isActive: true,
    })),
  )
  .onConflictDoUpdate({
    target: templates.id,
    set: {
      name: sql`excluded.name`,
      description: sql`excluded.description`,
      atsSafe: sql`excluded.ats_safe`,
      version: sql`excluded.version`,
      isActive: sql`excluded.is_active`,
      updatedAt: new Date(),
    },
  });

console.log(`Seeded ${templateDefinitions.length} templates`);
await pool.end();
