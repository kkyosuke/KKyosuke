import { sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const userTokens = sqliteTable(
	"user_tokens",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		service: text("service").notNull(),
		type: text("type").notNull(),
		token: text("token").notNull(),
		expiresAt: text("expires_at"),
		createdAt: text("created_at"),
		updatedAt: text("updated_at"),
	},
	(t) => [unique("user_service_type_idx").on(t.userId, t.service, t.type)],
);
