import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, type LanguageModelUsage, Output } from "ai";
import { z } from "zod";
import { buildReReviewPrompt } from "../../prompts/re-review/prompt";
import { REVIEW_MODEL_NAME } from "./cost";

/**
 * 再レビュー生成時に必要なコンテキスト
 */
export interface ReReviewContext {
	title: string;
	body: string | null;
	diff: string;

	instruction: string;
	template: string;
}

/**
 * 再レビュー結果のスキーマ定義
 */
export const reReviewSchema = z.object({
	overallStatus: z
		.string()
		.describe("全体ステータス (例: 🌟 全て解決！ / ⚠️ 残件あり)"),
	summary: z
		.array(z.string())
		.describe("再レビューの総評を箇条書きで簡潔に記載"),
	resolvedAndHandoff: z
		.array(z.string())
		.describe(
			"今回解決した点や改善されたポイント、および次に確認する人への申し送りを箇条書きのリストとして出力するため配列で記述してください。",
		),
	newFeedback: z
		.array(
			z.object({
				path: z
					.string()
					.describe("対象のファイルパス。全体に対する指摘の場合は '-'"),
				line: z
					.number()
					.describe("該当する行番号。特定できない場合は 0 または -1"),
				reason: z.string().describe("指摘理由"),
				severity: z.enum(["🔴 must", "🟡 want"]).describe("対応度"),
				summary: z.string().describe("指摘の具体的な内容"),
			}),
		)
		.describe("新規の重大な指摘点一覧。なければ空配列。"),
});

/**
 * 再レビュー結果の型
 */
export type ReReviewResult = z.infer<typeof reReviewSchema>;

/**
 * PR全体の再レビューを生成します。
 */
export async function generateReReview(
	env: Record<string, string | undefined>,
	context: ReReviewContext,
): Promise<{ output: ReReviewResult; usage: LanguageModelUsage }> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic(REVIEW_MODEL_NAME);

	const prompt = buildReReviewPrompt(context);

	const { output, usage } = await generateText({
		model,
		prompt,
		output: Output.object({ schema: reReviewSchema }),
	});

	return { output, usage };
}
