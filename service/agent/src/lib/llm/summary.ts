import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import summaryPromptTemplate from "../../prompts/summary/prompt.md" with {
	type: "text",
};
import { REVIEW_MODEL_NAME } from "./cost";

export const summarySchema = z.object({
	target_date: z
		.string()
		.describe("スレッド名(最初のメッセージ)から抽出した日付。YYYY-MM-DD形式。"),
	summary: z
		.array(
			z.object({
				user_id: z
					.string()
					.describe("対象ユーザーのID（<@U...>の形式からU...を抽出）"),
				progress: z
					.number()
					.min(0)
					.max(100)
					.describe("進捗状況のパーセンテージ（0〜100）"),
				score: z
					.number()
					.min(1)
					.max(5)
					.describe("取り組みに対する評価（5点満点）"),
				text: z
					.string()
					.describe(
						"後から見返した時に「何をして、どう解決したか」がわかる簡潔な要約",
					),
			}),
		)
		.describe("各ユーザーごとの進捗要約のリスト"),
});

export type ThreadSummary = z.infer<typeof summarySchema>;

/**
 * Slackのスレッド内容を要約します。
 */
export async function summarizeThread(
	env: Partial<import("../../config/env").CustomAppEnv>,
	threadContent: string,
): Promise<ThreadSummary> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic(REVIEW_MODEL_NAME);

	const prompt = summaryPromptTemplate.replace(
		"{{threadContent}}",
		threadContent,
	);

	const { object } = await generateObject({
		model,
		schema: summarySchema,
		prompt,
	});

	return object;
}
