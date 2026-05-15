import {
	createReplyForReviewComment,
	getPullRequest,
	getPullRequestDiff,
	getRepositoryFile,
	getReviewThreads,
	resolveReviewThread,
} from "../../lib/github";
import { REPOSITORY_GUIDELINES_PATH } from "../../config";
import { calculateCost, evaluateReviewThread, REVIEW_MODEL_NAME } from "../../lib/llm";
import threadInstruction from "../../prompts/re-review/thread-instruction.md" with {
	type: "text",
};

export async function runReplyAgent(
	env: Record<string, string | undefined>,
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

		const pr = await getPullRequest(
			env,
			installationId,
			owner,
			repo,
			pullNumber,
		);
		const diff = await getPullRequestDiff(
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
		const thread = reviewThreads.find((t: any) =>
			t.comments.nodes.some((c: any) => c.databaseId === commentId),
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
			.map((c: any) => `@${c.author?.login}: ${c.body}`)
			.join("\n\n---\n\n");

		console.log(`[ReplyAgent] Evaluating thread ${thread.id}`);

		let finalInstruction = threadInstruction;
		const guidelines = await getRepositoryFile(
			env,
			installationId,
			owner,
			repo,
			REPOSITORY_GUIDELINES_PATH,
			pr.head?.sha,
		);
		if (guidelines) {
			console.log(`[ReplyAgent] Found repository guidelines`);
			finalInstruction += `\n\n## リポジトリ固有のガイドライン\n以下のルールを必ず守って対応してください：\n\n${guidelines}`;
		}

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
					comments[0].databaseId, // スレッドの最初のコメントIDを指定して返信
					evalResult.replyBody,
				);
			} catch (e: any) {
				console.warn(
					`[ReplyAgent] Failed to reply to thread ${thread.id}:`,
					e.message,
				);
			}
		}

		if (
			evalResult.action === "RESOLVE" ||
			evalResult.action === "REPLY_AND_RESOLVE"
		) {
			try {
				await resolveReviewThread(env, installationId, thread.id);
			} catch (e: any) {
				console.warn(
					`[ReplyAgent] Failed to resolve thread ${thread.id}:`,
					e.message,
				);
			}
		}

		console.log(`[ReplyAgent] Completed reply for comment ${commentId}`);
	} catch (error: any) {
		console.error(`[ReplyAgent] Error in reply process:`, error);
	}
}
