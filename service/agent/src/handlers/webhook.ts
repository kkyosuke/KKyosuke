import { Webhooks } from "@octokit/webhooks";
import type { Context } from "hono";
import { env } from "hono/adapter";
import { CANCEL_SIGNAL_TTL_SECONDS } from "../config";
import { getBotName } from "../config/env";
import type { KVBinding } from "../jobs/common/types";
import { replyCommand, reReviewCommand } from "../jobs/github";
import {
	RE_REVIEW_CHECKBOX_CHECKED_PATTERN_SINGLE,
	RE_REVIEW_CHECKBOX_UNCHECKED_PATTERN_SINGLE,
} from "../jobs/github/constants";
import { routeCommentCommand } from "../jobs/github/router";
import type { CommandContext } from "../jobs/github/types";

type WebhookPayload = {
	action?: string;
	installation?: { id: number };
	repository: { owner: { login: string }; name: string };
	issue?: { number: number; pull_request?: unknown };
	pull_request?: { number: number };
	sender: { login: string };
	comment?: { body: string; id: number; in_reply_to_id?: number };
	review?: { body: string; id: number };
	changes?: { body?: { from?: string } };
};

/**
 * Webhookのペイロードからコマンド実行用のコンテキストを構築します。
 *
 * @param e - 環境変数
 * @param payload - Webhookのペイロード
 * @param commentInfo - コメント情報
 * @returns コマンドコンテキスト、または失敗時にnull
 */
function buildCommandContext(
	e: Record<string, string | undefined>,
	payload: WebhookPayload,
	commentInfo: { body: string; id: number; isReviewSummary?: boolean },
): CommandContext | null {
	const installationId = payload.installation?.id;
	if (!installationId) {
		console.error("[Webhook] No installationId found in webhook payload");
		return null;
	}

	return {
		env: e,
		installationId,
		owner: payload.repository.owner.login,
		repo: payload.repository.name,
		issueNumber: payload.issue?.number || payload.pull_request?.number || 0,
		commentBody: commentInfo.body,
		commentId: commentInfo.id,
		isReviewSummary: commentInfo.isReviewSummary,
		botName: getBotName(e),
		sender: payload.sender.login,
	};
}

/**
 * 非同期タスクをバックグラウンドで実行します。
 *
 * @param c - Honoコンテキスト
 * @param task - 実行する非同期タスク
 * @param taskName - ログ出力用のタスク名
 */
function dispatchBackgroundTask(
	c: Context,
	task: Promise<void>,
	taskName: string,
) {
	const safeTask = task.catch((err) =>
		console.error(`[Webhook] ${taskName} failed critically:`, err),
	);
	try {
		if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
			c.executionCtx.waitUntil(safeTask);
		}
	} catch {
		// fire and forget
	}
}

/**
 * GitHub Webhookのリクエストを受け取り、適切なジョブにルーティングします。
 *
 * @param c - Honoコンテキスト
 * @returns レスポンス
 */
export async function githubWebhookHandler(c: Context) {
	const e = env<Record<string, string | undefined>>(c);
	const webhooks = new Webhooks({
		secret: e.GITHUB_WEBHOOK_SECRET || "",
	});

	const signature = c.req.header("x-hub-signature-256");
	const eventName = c.req.header("x-github-event");
	const id = c.req.header("x-github-delivery");

	console.log(`[Webhook] Received event: ${eventName}, delivery ID: ${id}`);

	if (!signature || !eventName || !id) {
		console.warn(
			`[Webhook] Missing headers. signature: ${!!signature}, eventName: ${!!eventName}, id: ${!!id}`,
		);
		return c.text("Missing required GitHub headers", 400);
	}

	const rawBody = await c.req.text();

	try {
		const isValid = await webhooks.verify(rawBody, signature);
		if (!isValid) {
			console.warn(`[Webhook] Invalid signature for event ${eventName}`);
			return c.text("Invalid signature", 401);
		}
		console.log(`[Webhook] Signature verified successfully`);
	} catch (error) {
		console.error(`[Webhook] Error verifying signature:`, error);
		return c.text("Error verifying signature", 500);
	}

	let payload: WebhookPayload;
	try {
		payload = JSON.parse(rawBody);
	} catch (_err) {
		console.warn(`[Webhook] Invalid JSON payload`);
		return c.text("Invalid JSON", 400);
	}

	const action = payload.action;
	const eventAction = `${eventName}.${action}`;
	let routingTask: Promise<void> | undefined;
	let taskName = "UnknownTask";

	switch (eventAction) {
		case "issue_comment.created":
		case "issue_comment.edited": {
			console.log(`[Webhook] Processing ${eventAction} event`);
			if (!payload.issue?.pull_request || !payload.comment) {
				console.log(
					`[Webhook] Ignored comment: not a pull request issue or missing comment`,
				);
				break;
			}

			const commentBody = payload.comment.body || "";
			const ctx = buildCommandContext(e, payload, {
				body: commentBody,
				id: payload.comment.id,
			});
			if (!ctx) break;

			if (action === "edited") {
				const fromBody = payload.changes?.body?.from || "";
				const uncheckedRegex = RE_REVIEW_CHECKBOX_UNCHECKED_PATTERN_SINGLE;
				const checkedRegex = RE_REVIEW_CHECKBOX_CHECKED_PATTERN_SINGLE;

				if (uncheckedRegex.test(fromBody) && checkedRegex.test(commentBody)) {
					console.log(
						`[Webhook] Checkbox checked for re-review on PR ${ctx.issueNumber}`,
					);
					routingTask = reReviewCommand.execute(ctx);
					taskName = "ReReviewCommand";
				} else {
					console.log(
						`[Webhook] Ignored edited comment: checkbox not triggered`,
					);
				}
			} else {
				// created の場合は通常のメンションルーティング
				routingTask = routeCommentCommand(ctx);
				taskName = "RouteCommentCommand";
			}
			console.log(`[Webhook] Finished processing ${eventAction} event`);
			break;
		}

		case "pull_request_review.edited": {
			console.log(`[Webhook] Processing ${eventAction} event`);
			if (!payload.review) break;

			const commentBody = payload.review.body || "";
			const fromBody = payload.changes?.body?.from || "";

			const uncheckedRegex = RE_REVIEW_CHECKBOX_UNCHECKED_PATTERN_SINGLE;
			const checkedRegex = RE_REVIEW_CHECKBOX_CHECKED_PATTERN_SINGLE;

			if (uncheckedRegex.test(fromBody) && checkedRegex.test(commentBody)) {
				const ctx = buildCommandContext(e, payload, {
					body: commentBody,
					id: payload.review.id,
					isReviewSummary: true,
				});
				if (!ctx) break;

				console.log(
					`[Webhook] Checkbox checked for re-review on PR ${ctx.issueNumber} (Review Summary)`,
				);
				routingTask = reReviewCommand.execute(ctx);
				taskName = "ReReviewCommand";
			} else {
				console.log(`[Webhook] Ignored edited review: checkbox not triggered`);
			}
			break;
		}

		case "pull_request_review_comment.created": {
			console.log(`[Webhook] Processing ${eventAction} event`);
			if (!payload.comment) break;

			const commentBody = payload.comment.body || "";
			const ctx = buildCommandContext(e, payload, {
				body: commentBody,
				id: payload.comment.id,
			});
			if (!ctx) break;

			// ボット自身のコメントは無視する
			if (ctx.sender === ctx.botName || ctx.sender.includes("bot")) {
				console.log(`[Webhook] Ignored own review comment`);
				break;
			}

			if (
				commentBody.includes(`@${ctx.botName}`) ||
				payload.comment.in_reply_to_id
			) {
				console.log(
					`[Webhook] Triggering replyCommand for review comment ${payload.comment.id}`,
				);
				routingTask = replyCommand.execute(ctx);
				taskName = "ReplyCommand";
			} else {
				console.log(
					`[Webhook] Ignored review comment: no mention and not a reply`,
				);
			}
			console.log(`[Webhook] Finished processing ${eventAction} event`);
			break;
		}

		case "pull_request.synchronize": {
			console.log(`[Webhook] Processing ${eventAction} event`);
			if (!payload.pull_request) break;

			const owner = payload.repository.owner.login;
			const repo = payload.repository.name;
			const pullNumber = payload.pull_request.number;

			const kv = (e as Record<string, unknown>).KKYOSUKE_GITHUB_APP_KV as
				| KVBinding
				| undefined;
			if (kv) {
				const cancelKey = `cancel-review-${owner}-${repo}-${pullNumber}`;
				console.log(`[Webhook] Setting cancellation flag for ${cancelKey}`);
				await kv
					.put(cancelKey, "1", { expirationTtl: CANCEL_SIGNAL_TTL_SECONDS })
					.catch((err: unknown) => {
						console.error(`[Webhook] Failed to set cancellation flag:`, err);
					});
			} else {
				console.warn(`[Webhook] KV not found, cannot set cancellation flag`);
			}
			break;
		}

		default: {
			console.log(
				`[Webhook] Ignored event: ${eventName}, action: ${payload.action}`,
			);
			break;
		}
	}

	if (routingTask) {
		dispatchBackgroundTask(c, routingTask, taskName);
	}

	// GitHub Webhook に即座に200を返す
	return c.text("OK", 200);
}
