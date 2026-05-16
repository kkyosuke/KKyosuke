import {
	createReplyForReviewComment,
	type ReviewThread,
	resolveReviewThread,
} from "../../lib/github";
import {
	calculateCost,
	evaluateReviewThread,
	REVIEW_MODEL_NAME,
} from "../../lib/llm";
import threadInstruction from "../../prompts/re-review/thread-instruction.md" with {
	type: "text",
};

/**
 * 未解決のレビュースレッドを評価し、必要に応じて返信や解決を行います。
 *
 * @param env - 環境変数
 * @param installationId - GitHub AppのインストールID
 * @param owner - リポジトリのオーナー名
 * @param repo - リポジトリ名
 * @param pullNumber - PR番号
 * @param diff - 差分情報
 * @param reviewThreads - レビュースレッド一覧
 * @param guidelines - リポジトリ固有のガイドライン
 * @returns LLMの消費コスト
 */
export async function processReviewThreads(
	env: Record<string, string | undefined>,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
	diff: string,
	reviewThreads: ReviewThread[],
	guidelines?: string | null,
): Promise<number> {
	let totalCost = 0;

	await Promise.all(
		reviewThreads.map(async (thread) => {
			if (thread.isResolved || !thread.comments?.nodes?.length) return;

			const comments = thread.comments.nodes;
			const firstComment = comments?.[0];
			if (!firstComment) return;

			const firstCommentAuthor =
				firstComment.author?.login?.toLowerCase() || "";
			const isBotThread =
				firstCommentAuthor.includes("bot") || firstCommentAuthor.includes("ai");

			if (!isBotThread) return;

			console.log(`[ReReviewThreads] Evaluating thread ${thread.id}`);
			const threadCommentsText = comments
				.map((c) => `@${c.author?.login}: ${c.body}`)
				.join("\n\n---\n\n");

			let finalInstruction = threadInstruction;
			if (guidelines) {
				finalInstruction += `\n\n## リポジトリ固有のガイドライン\n以下のルールを必ず守って対応してください：\n\n${guidelines}`;
			}

			const { output: evalResult, usage: evalUsage } =
				await evaluateReviewThread(env, {
					threadComments: `[ファイル: ${thread.path}, 行: ${thread.line}]\n\n${threadCommentsText}`,
					diff,
					instruction: finalInstruction,
				});

			totalCost += calculateCost(evalUsage, REVIEW_MODEL_NAME);

			console.log(
				`[ReReviewThreads] Thread ${thread.id} action: ${evalResult.action}`,
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
						firstComment.databaseId,
						evalResult.replyBody,
					);
				} catch (e: unknown) {
					console.warn(
						`[ReReviewThreads] Failed to reply to thread ${thread.id}:`,
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
					thread.isResolved = true; // Mark as resolved in memory
				} catch (e: unknown) {
					console.warn(
						`[ReReviewThreads] Failed to resolve thread ${thread.id}:`,
						e instanceof Error ? e.message : String(e),
					);
				}
			}
		}),
	);

	return totalCost;
}
