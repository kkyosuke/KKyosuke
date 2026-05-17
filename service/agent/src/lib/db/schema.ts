import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const progressSummaries = sqliteTable(
	"progress_summaries",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		targetDate: text("target_date").notNull(),
		progressPercent: integer("progress_percent").notNull(),
		evaluationScore: integer("evaluation_score").notNull(),
		summaryText: text("summary_text").notNull(),
		createdAt: text("created_at"),
	},
	(t) => [unique("user_id_target_date_idx").on(t.userId, t.targetDate)],
);

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
