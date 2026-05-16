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
