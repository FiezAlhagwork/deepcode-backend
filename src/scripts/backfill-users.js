/**
 * One-off backfill for Clerk accounts that existed before the users
 * webhook (src/features/users/webhook.routes.js) was wired up — those
 * accounts never fired a `user.created` event, so they have no local
 * `User` document until they happen to trigger a `user.updated` event.
 *
 * Pages through every Clerk user via the Backend API and upserts each one
 * locally, seeding `role` from their current `publicMetadata.role` (falling
 * back to "user") — the one deliberate case where reading role FROM Clerk is
 * correct, since it's retiring the old source of truth into the new one.
 * upsertUser() never touches `role` on a document that already exists, so
 * this script is safe to re-run.
 *
 * Usage: npm run backfill:users
 */
import { clerkClient } from "@clerk/express";
import { connectDB } from "../config/db.js";
import { upsertUser } from "../features/users/user.service.js";
import { User } from "../features/users/user.model.js";

const PAGE_SIZE = 100;

const run = async () => {
  await connectDB();

  let offset = 0;
  let created = 0;
  let updated = 0;

  while (true) {
    const { data: users } = await clerkClient.users.getUserList({
      limit: PAGE_SIZE,
      offset,
    });

    if (users.length === 0) break;

    for (const user of users) {
      const primary = user.emailAddresses?.find(
        (e) => e.id === user.primaryEmailAddressId,
      );
      const email = (primary ?? user.emailAddresses?.[0])?.emailAddress ?? null;

      if (!email) {
        console.warn(`⚠️  Skipping Clerk user ${user.id} — no email address.`);
        continue;
      }

      const existedBefore = Boolean(await User.exists({ clerkId: user.id }));

      await upsertUser({
        clerkId: user.id,
        email,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        role: user.publicMetadata?.role,
      });

      existedBefore ? updated++ : created++;
    }

    offset += users.length;
    if (users.length < PAGE_SIZE) break;
  }

  console.log(`✅ Backfill complete — created: ${created}, updated: ${updated}.`);
  process.exit(0);
};

run().catch((error) => {
  console.error("❌ Backfill failed:", error);
  process.exit(1);
});
