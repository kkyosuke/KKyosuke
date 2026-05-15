import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, type LanguageModelUsage, Output } from "ai";
import { z } from "zod";
import { REVIEW_MODEL_NAME } from "./cost";
import { buildThreadPrompt } from "../../prompts/thread/prompt";

/**
 * レビュースレッド評価時に必要なコンテキスト
 */
export interface ThreadEvaluationContext {
	threadComments: string;
	diff: string;
	instruction: string;
}

/**
 * スレッド返信内容のスキーマ定義
 */
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

/**
 * スレッド返信内容の型
 */
export type ThreadReplyResult = z.infer<typeof threadReplySchema>;

/**
 * レビュースレッドの内容を評価し、アクションと返信を生成します。
 */
export async function evaluateReviewThread(
	env: Record<string, string | undefined>,
	context: ThreadEvaluationContext,
): Promise<{ output: ThreadReplyResult; usage: LanguageModelUsage }> {
	const anthropic = createAnthropic({
		apiKey: env.ANTHROPIC_API_KEY || "",
	});

	const model = anthropic(REVIEW_MODEL_NAME);

	const prompt = buildThreadPrompt(context);

	const { output, usage } = await generateText({
		model,
		prompt,
		output: Output.object({ schema: threadReplySchema }),
	});

	return { output, usage };
}
