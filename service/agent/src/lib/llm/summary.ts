import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { CustomAppEnv } from "../../config/env";
import summaryPromptTemplate from "../../prompts/summary/prompt.md" with {
	type: "text",
};

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
					.describe("進捗状況のパーセンテージ（100%を超える場合もあります）"),
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
	env: Partial<CustomAppEnv>,
	threadContent: string,
	modelName: string,
): Promise<ThreadSummary> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic(modelName);

	const prompt = summaryPromptTemplate.replace(
		"{{threadContent}}",
		threadContent,
	);

	console.log("[LLM:summarizeThread] Sending prompt:\n", prompt);

	try {
		const { object, usage } = await generateObject({
			model,
			schema: summarySchema,
			prompt,
		});

		console.log(
			"[LLM:summarizeThread] Generated object:\n",
			JSON.stringify(object, null, 2),
		);
		console.log("[LLM:summarizeThread] Usage:\n", usage);

		return object;
	} catch (error: unknown) {
		const err = error as Error & { text?: string };
		console.error("[LLM:summarizeThread] Error:", err.message || String(error));
		if (err.text) {
			console.error("[LLM:summarizeThread] Raw Text:", err.text);
		}
		throw error;
	}
}
