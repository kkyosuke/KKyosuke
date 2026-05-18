import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import shareSummaryPromptTemplate from "../../prompts/weekly-report/prompt.md" with {
	type: "text",
};
import { REVIEW_MODEL_NAME } from "./cost";

export const weeklyReportSchema = z.object({
	summaries: z
		.array(
			z.object({
				user_id: z
					.string()
					.describe("対象ユーザーのID（<@U...>の形式からU...を抽出）"),
				ratio_text: z
					.string()
					.describe("先々週と先週の比較（例：先々週比120%、スコア1UPなど）"),
				summary_text: z.string().describe("先週の具体的な成果や活動内容の要約"),
				next_action_text: z
					.string()
					.describe("先週の結果を踏まえた、今週に向けたアクションプランや目標"),
			}),
		)
		.describe("各ユーザーごとの週次進捗まとめのリスト"),
});

export type WeeklyReportSummary = z.infer<typeof weeklyReportSchema>;

/**
 * 先週と先々週の進捗データを基に、週次進捗まとめを生成します。
 */
export async function generateWeeklyShareSummary(
	env: Partial<import("../../config/env").CustomAppEnv>,
	weekBeforeLastData: string,
	lastWeekData: string,
): Promise<WeeklyReportSummary> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic(REVIEW_MODEL_NAME);

	const prompt = shareSummaryPromptTemplate
		.replace("{{weekBeforeLastData}}", weekBeforeLastData)
		.replace("{{lastWeekData}}", lastWeekData);

	const { object } = await generateObject({
		model,
		schema: weeklyReportSchema,
		prompt,
	});

	return object;
}
