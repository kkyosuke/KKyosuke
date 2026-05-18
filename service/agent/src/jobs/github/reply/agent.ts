import {
	createReplyForReviewComment,
	getReviewThreads,
	resolveReviewThread,
} from "../../../lib/github";
import type { CustomAppEnv } from "../../../config/env";
import {
	calculateCost,
	evaluateReviewThread,
	REVIEW_MODEL_NAME,
} from "../../../lib/llm";
import threadInstruction from "../../../prompts/re-review/thread-instruction.md" with {
	type: "text",
};
import {
	buildInstructionWithGuidelines,
	fetchReviewContext,
} from "../utils/context";

/**
 * PRのコメントに対する返信処理をバックグラウンドで実行します。
 *
 * @param env - 環境変数
 * @param installationId - GitHub AppのインストールID
 * @param owner - リポジトリのオーナー名
 * @param repo - リポジトリ名
 * @param pullNumber - PR番号
 * @param commentId - 対象のコメントID
 */
export async function runReplyAgent(
	env: Partial<CustomAppEnv>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	commentId: number,
) {
	try {
		console.log(
			`[ReplyAgent] Starting reply for ${owner}/${repo}#${pullNumber} comment ${commentId}`,
		);

		const { diff, guidelines } = await fetchReviewContext(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
		);
		const reviewThreads = await getReviewThreads(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
		);

		// 指定されたコメントIDが含まれるスレッドを検索
		const thread = reviewThreads.find((t) =>
			t.comments.nodes.some((c) => c.databaseId === commentId),
		);

		if (!thread) {
			console.log(`[ReplyAgent] Thread not found for comment ${commentId}`);
			return;
		}

		if (thread.isResolved || !thread.comments?.nodes?.length) {
			console.log(`[ReplyAgent] Thread is already resolved or empty`);
			return;
		}

		const comments = thread.comments.nodes;
		const threadCommentsText = comments
			.map((c) => `@${c.author?.login}: ${c.body}`)
			.join("\n\n---\n\n");

		console.log(`[ReplyAgent] Evaluating thread ${thread.id}`);

		if (guidelines) {
			console.log(`[ReplyAgent] Found repository guidelines`);
		}
		const finalInstruction = buildInstructionWithGuidelines(
			threadInstruction,
			guidelines,
		);

		const { output: evalResult, usage: evalUsage } = await evaluateReviewThread(
			env,
			{
				threadComments: `[ファイル: ${thread.path}, 行: ${thread.line}]\n\n${threadCommentsText}`,
				diff,
				instruction: finalInstruction,
			},
		);

		const cost = calculateCost(evalUsage, REVIEW_MODEL_NAME);
		console.log(
			`[ReplyAgent] Action: ${evalResult.action}, Cost: $${cost.toFixed(4)}`,
		);

		if (
			(evalResult.action === "REPLY" ||
				evalResult.action === "REPLY_AND_RESOLVE") &&
			evalResult.replyBody
		) {
			try {
				await createReplyForReviewComment(
					env,
					installationId,
					owner,
					repo,
					pullNumber,
					comments[0]?.databaseId ?? 0, // スレッドの最初のコメントIDを指定して返信
					evalResult.replyBody,
				);
			} catch (e: unknown) {
				console.warn(
					`[ReplyAgent] Failed to reply to thread ${thread.id}:`,
					e instanceof Error ? e.message : String(e),
				);
			}
		}

		if (
			evalResult.action === "RESOLVE" ||
			evalResult.action === "REPLY_AND_RESOLVE"
		) {
			try {
				await resolveReviewThread(env, installationId, thread.id);
			} catch (e: unknown) {
				console.warn(
					`[ReplyAgent] Failed to resolve thread ${thread.id}:`,
					e instanceof Error ? e.message : String(e),
				);
			}
		}

		console.log(`[ReplyAgent] Completed reply for comment ${commentId}`);
	} catch (error: unknown) {
		console.error(`[ReplyAgent] Error in reply process:`, error);
	}
}
