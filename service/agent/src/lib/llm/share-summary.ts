import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import shareSummaryPromptTemplate from "../../prompts/share-summary/prompt.md" with {
	type: "text",
};
import { REVIEW_MODEL_NAME } from "./cost";

export const shareSummarySchema = z.object({
	summaries: z
		.array(
			z.object({
				user_id: z
					.string()
					.describe("対象ユーザーのID（<@U...>の形式からU...を抽出）"),
				ratio_text: z
					.string()
					.describe("先週と今週の比較（例：先週比120%、スコア1UPなど）"),
				summary_text: z.string().describe("今週の具体的な成果や活動内容の要約"),
				next_action_text: z
					.string()
					.describe("今週の結果を踏まえた、来週に向けたアクションプランや目標"),
			}),
		)
		.describe("各ユーザーごとの週次進捗まとめのリスト"),
});

export type WeeklyShareSummary = z.infer<typeof shareSummarySchema>;

/**
 * 今週と先週の進捗データを基に、週次進捗まとめを生成します。
 */
export async function generateWeeklyShareSummary(
	env: Record<string, string | undefined>,
	lastWeekData: string,
	thisWeekData: string,
): Promise<WeeklyShareSummary> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic(REVIEW_MODEL_NAME);

	const prompt = shareSummaryPromptTemplate
		.replace("{{lastWeekData}}", lastWeekData)
		.replace("{{thisWeekData}}", thisWeekData);

	const { object } = await generateObject({
		model,
		schema: shareSummarySchema,
		prompt,
	});

	return object;
}
