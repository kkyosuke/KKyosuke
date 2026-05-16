import { eq, and } from "drizzle-orm";
import type { DBClient } from "../../lib/db";
import { userTokens } from "../../lib/db/schema";

export async function getUserTokenByType(db: DBClient, userId: string, type: string) {
	const result = await db
		.select()
		.from(userTokens)
		.where(and(eq(userTokens.userId, userId), eq(userTokens.type, type)));
	
	return result.length > 0 ? result[0] : null;
}

export async function saveUserToken(
	db: DBClient,
	userId: string,
	type: string,
	token: string,
	expiresAt: string | null,
) {
	const existing = await getUserTokenByType(db, userId, type);
	const now = new Date().toISOString();

	if (existing) {
		await db
			.update(userTokens)
			.set({
				token,
				expiresAt,
				updatedAt: now,
			})
			.where(eq(userTokens.id, existing.id));
	} else {
		await db.insert(userTokens).values({
			id: crypto.randomUUID(),
			userId,
			type,
			token,
			expiresAt,
			createdAt: now,
			updatedAt: now,
		});
	}
}
