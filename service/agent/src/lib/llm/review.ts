import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, type LanguageModelUsage, Output } from "ai";
import { z } from "zod";
import { buildReviewPrompt } from "../../prompts/review/prompt";
import type { CustomAppEnv } from "../../config/env";
import { REVIEW_MODEL_NAME } from "./cost";

/**
 * レビュー生成時に必要なコンテキスト
 */
export interface ReviewContext {
	title: string;
	body: string | null;
	diff: string;
	comments: string;
	instruction: string;
	template: string;
}

/**
 * レビュー結果のスキーマ定義
 */
export const reviewSchema = z.object({
	overallEvaluation: z
		.string()
		.describe("総合評価 (例: 🌟 Excellent / 👍 Good / ⚠️ Fair / ❌ Poor)"),
	summary: z
		.string()
		.describe("PR全体の評価、良かった点、懸念事項などについて簡潔に記載"),
	feedback: z
		.array(
			z.object({
				path: z
					.string()
					.describe(
						"対象のファイルパス (例: src/index.ts) 全体に対する指摘の場合は '-'",
					),
				line: z
					.number()
					.describe(
						"該当する行番号。全体に対する指摘など特定できない場合は 0 または -1",
					),
				reason: z.string().describe("指摘理由 (バグの可能性、可読性など)"),
				severity: z.enum(["🔴 must", "🟡 want"]).describe("対応度"),
				summary: z.string().describe("指摘の具体的な内容を簡潔に記載"),
			}),
		)
		.describe(
			"指摘点一覧。重要度が高い順に最大10個まで出力してください。指摘がない場合は空配列。",
		),
	scores: z
		.object({
			functionality: z
				.object({ score: z.number().min(0).max(5), comment: z.string() })
				.describe("機能の正確性・バグのリスク"),
			security: z
				.object({ score: z.number().min(0).max(5), comment: z.string() })
				.describe("セキュリティ"),
			maintainability: z
				.object({ score: z.number().min(0).max(5), comment: z.string() })
				.describe("保守性・可読性"),
			performance: z
				.object({ score: z.number().min(0).max(5), comment: z.string() })
				.describe("パフォーマンス"),
			testQuality: z
				.object({ score: z.number().min(0).max(5), comment: z.string() })
				.describe("テスト品質"),
			architecture: z
				.object({ score: z.number().min(0).max(5), comment: z.string() })
				.describe("設計・アーキテクチャ"),
			documentation: z
				.object({ score: z.number().min(0).max(5), comment: z.string() })
				.describe("PR要件・ドキュメント"),
		})
		.describe("評価スコア詳細 (各5点満点)"),
});

/**
 * レビュー結果の型
 */
export type ReviewResult = z.infer<typeof reviewSchema>;

/**
 * PR全体のコードレビューを生成します。
 */
export async function generateCodeReview(
	env: Partial<CustomAppEnv>,
	context: ReviewContext,
): Promise<{ output: ReviewResult; usage: LanguageModelUsage }> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic(REVIEW_MODEL_NAME);

	const prompt = buildReviewPrompt(context);

	const { output, usage } = await generateText({
		model,
		prompt,
		output: Output.object({ schema: reviewSchema }),
	});

	return { output, usage };
}
