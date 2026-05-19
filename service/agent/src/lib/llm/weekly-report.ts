import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { CustomAppEnv } from "../../config/env";
import shareSummaryPromptTemplate from "../../prompts/weekly-report/prompt.md" with {
	type: "text",
};

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
	env: Partial<CustomAppEnv>,
	weekBeforeLastData: string,
	lastWeekData: string,
	modelName: string,
): Promise<WeeklyReportSummary> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic(modelName);

	const prompt = shareSummaryPromptTemplate
		.replace("{{weekBeforeLastData}}", weekBeforeLastData)
		.replace("{{lastWeekData}}", lastWeekData);

	const { output: object } = await generateText({
		model,
		prompt,
		output: Output.object({ schema: weeklyReportSchema }),
	});

	return object;
}
