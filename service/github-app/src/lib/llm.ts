import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, type LanguageModelUsage, Output } from "ai";
import { z } from "zod";

export const REVIEW_MODEL_NAME = "claude-haiku-4-5";

type PricingRates = {
	baseInput: number;
	cacheWrites5m: number;
	cacheReads: number;
	output: number;
};

const MODEL_PRICING: Record<string, PricingRates> = {
	"claude-haiku-4-5": {
		baseInput: 1.0,
		cacheWrites5m: 1.25,
		cacheReads: 0.1,
		output: 5.0,
	},
	"claude-sonnet-4-5": {
		baseInput: 3.0,
		cacheWrites5m: 3.75,
		cacheReads: 0.3,
		output: 15.0,
	},
	"claude-opus-4-6": {
		baseInput: 5.0,
		cacheWrites5m: 6.25,
		cacheReads: 0.5,
		output: 25.0,
	},
};

export const calculateCost = (
	usage: LanguageModelUsage,
	modelName: string,
): number => {
	const fallback = MODEL_PRICING["claude-haiku-4-5"] as PricingRates;
	const rates = MODEL_PRICING[modelName] ?? fallback; // Fallback to Haiku

	const cacheWrites = usage.inputTokenDetails?.cacheWriteTokens || 0;
	const cacheReads = usage.inputTokenDetails?.cacheReadTokens || 0;
	const baseTokens =
		usage.inputTokenDetails?.noCacheTokens ??
		(usage.inputTokens || 0) - cacheWrites - cacheReads;
	const outputTokens = usage.outputTokens || 0;

	const cost =
		(baseTokens / 1_000_000) * rates.baseInput +
		(cacheWrites / 1_000_000) * rates.cacheWrites5m +
		(cacheReads / 1_000_000) * rates.cacheReads +
		(outputTokens / 1_000_000) * rates.output;

	return cost;
};

export interface ReviewContext {
	title: string;
	body: string | null;
	diff: string;
	comments: string;
	instruction: string;
	template: string;
}

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

export type ReviewResult = z.infer<typeof reviewSchema>;

export async function generateCodeReview(
	env: Record<string, string | undefined>,
	context: ReviewContext,
): Promise<{ output: ReviewResult; usage: LanguageModelUsage }> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic(REVIEW_MODEL_NAME);

	const prompt = `
${context.instruction}

## 【出力テンプレートの参考情報】
${context.template}

---
以下が対象の Pull Request の情報です。

## PR タイトル
${context.title}

## PR 概要
${context.body || "なし"}

## コメント履歴
${context.comments || "なし"}

## 変更差分 (Diff)
\`\`\`diff
${context.diff}
\`\`\`
`;

	const { output, usage } = await generateText({
		model,
		prompt,
		output: Output.object({ schema: reviewSchema }),
	});

	return { output, usage };
}

export interface ReReviewContext {
	title: string;
	body: string | null;
	diff: string;

	instruction: string;
	template: string;
}

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

export type ReReviewResult = z.infer<typeof reReviewSchema>;

export async function generateReReview(
	env: Record<string, string | undefined>,
	context: ReReviewContext,
): Promise<{ output: ReReviewResult; usage: LanguageModelUsage }> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic(REVIEW_MODEL_NAME);

	const prompt = `
${context.instruction}

## 【出力テンプレートの参考情報】
${context.template}

---
以下が対象の Pull Request の情報です。

## PR タイトル
${context.title}

## PR 概要
${context.body || "なし"}


## 最新の変更差分 (Diff)
\`\`\`diff
${context.diff}
\`\`\`
`;

	const { output, usage } = await generateText({
		model,
		prompt,
		output: Output.object({ schema: reReviewSchema }),
	});

	return { output, usage };
}

export interface ThreadEvaluationContext {
	threadComments: string;
	diff: string;
	instruction: string;
}

export const threadReplySchema = z.object({
	action: z
		.enum(["REPLY", "RESOLVE", "REPLY_AND_RESOLVE", "IGNORE"])
		.describe("アクション"),
	replyBody: z
		.string()
		.optional()
		.describe("返信内容 (actionがREPLY/REPLY_AND_RESOLVEの場合必須)"),
	reason: z.string().describe("アクションを選択した理由"),
});

export type ThreadReplyResult = z.infer<typeof threadReplySchema>;

export async function evaluateReviewThread(
	env: Record<string, string | undefined>,
	context: ThreadEvaluationContext,
): Promise<{ output: ThreadReplyResult; usage: LanguageModelUsage }> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic(REVIEW_MODEL_NAME);

	const prompt = `
${context.instruction}

---
以下が対象のコメントスレッドと最新のコード差分です。

## コメントスレッド
${context.threadComments}

## 最新のコード差分 (Diff)
\`\`\`diff
${context.diff}
\`\`\`
`;

	const { output, usage } = await generateText({
		model,
		prompt,
		output: Output.object({ schema: threadReplySchema }),
	});

	return { output, usage };
}
