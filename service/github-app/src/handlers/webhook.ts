import { Webhooks } from "@octokit/webhooks";
import type { Context } from "hono";
import { env } from "hono/adapter";
import { getBotName } from "../config/env";
import { CANCEL_SIGNAL_TTL_SECONDS } from "../config";
import { reReviewCommand, replyCommand } from "../jobs";
import {
	RE_REVIEW_CHECKBOX_CHECKED_PATTERN_SINGLE,
	RE_REVIEW_CHECKBOX_UNCHECKED_PATTERN_SINGLE,
} from "../jobs/constants";
import { routeCommentCommand } from "../routers/commentRouter";

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
		// 署名検証
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

	// ペイロードのパース
	let payload: any;
	try {
		payload = JSON.parse(rawBody);
	} catch (err) {
		console.warn(`[Webhook] Invalid JSON payload`);
		return c.text("Invalid JSON", 400);
	}

	// 条件判定: issue_comment (PR含む) かつ action === 'created' または 'edited'
	if (
		eventName === "issue_comment" &&
		(payload.action === "created" || payload.action === "edited")
	) {
		console.log(`[Webhook] Processing issue_comment.${payload.action} event`);
		// PRへのコメントであることの確認
		if (payload.issue && payload.issue.pull_request) {
			const commentBody = payload.comment?.body || "";
			const owner = payload.repository.owner.login;
			const repo = payload.repository.name;
			const pullNumber = payload.issue.number;
			const installationId = payload.installation?.id;

			if (!installationId) {
				console.error("[Webhook] No installationId found in webhook payload");
				return c.text("OK", 200);
			}

			const sender = payload.sender.login;
			const botName = getBotName(e);

			const commandCtx = {
				env: e,
				installationId,
				owner,
				repo,
				issueNumber: pullNumber,
				commentBody,
				commentId: payload.comment.id,
				botName,
				sender,
			};

			let routingTask: Promise<void>;

			// edited の場合、チェックボックスのONを検知する
			if (payload.action === "edited") {
				const fromBody = payload.changes?.body?.from || "";
				// 前のコメントにはチェックなしの項目があり、現在のコメントにはチェックありの項目があるか
				const uncheckedRegex = RE_REVIEW_CHECKBOX_UNCHECKED_PATTERN_SINGLE;
				const checkedRegex = RE_REVIEW_CHECKBOX_CHECKED_PATTERN_SINGLE;

				if (uncheckedRegex.test(fromBody) && checkedRegex.test(commentBody)) {
					console.log(
						`[Webhook] Checkbox checked for re-review on PR ${pullNumber}`,
					);
					routingTask = reReviewCommand
						.execute(commandCtx)
						.catch((err) =>
							console.error("Re-review command failed critically", err),
						);
				} else {
					console.log(
						`[Webhook] Ignored edited comment: checkbox not triggered`,
					);
					return c.text("OK", 200);
				}
			} else {
				// created の場合は通常のメンションルーティング
				routingTask = routeCommentCommand(commandCtx).catch((err) =>
					console.error("Router failed critically", err),
				);
			}

			try {
				if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
					// Cloudflare Workers 等でのバックグラウンド実行
					c.executionCtx.waitUntil(routingTask);
				}
			} catch {
				// ローカル Bun 環境などで c.executionCtx へのアクセスがエラーになる場合は無視
				// fire and forget のまま
			}
		} else {
			console.log(`[Webhook] Ignored comment: not a pull request issue`);
		}
		console.log(
			`[Webhook] Finished processing issue_comment.${payload.action} event`,
		);
	} else if (
		eventName === "pull_request_review" &&
		payload.action === "edited"
	) {
		console.log(`[Webhook] Processing pull_request_review.edited event`);
		const owner = payload.repository.owner.login;
		const repo = payload.repository.name;
		const pullNumber = payload.pull_request.number;
		const installationId = payload.installation?.id;

		if (!installationId) {
			console.error("[Webhook] No installationId found in webhook payload");
			return c.text("OK", 200);
		}

		const fromBody = payload.changes?.body?.from || "";
		const commentBody = payload.review?.body || "";
		const uncheckedRegex = RE_REVIEW_CHECKBOX_UNCHECKED_PATTERN_SINGLE;
		const checkedRegex = RE_REVIEW_CHECKBOX_CHECKED_PATTERN_SINGLE;

		if (uncheckedRegex.test(fromBody) && checkedRegex.test(commentBody)) {
			console.log(`[Webhook] Checkbox checked for re-review on PR ${pullNumber} (Review Summary)`);
			
			const sender = payload.sender.login;
			const botName = getBotName(e);
			
			const commandCtx = {
				env: e,
				installationId,
				owner,
				repo,
				issueNumber: pullNumber,
				commentBody,
				commentId: payload.review.id,
				isReviewSummary: true,
				botName,
				sender,
			};

			const routingTask = reReviewCommand
				.execute(commandCtx)
				.catch((err) =>
					console.error("Re-review command failed critically", err),
				);

			try {
				if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
					c.executionCtx.waitUntil(routingTask);
				}
			} catch {
				// fire and forget
			}
		} else {
			console.log(`[Webhook] Ignored edited review: checkbox not triggered`);
		}
		
	} else if (
		eventName === "pull_request_review_comment" &&
		payload.action === "created"
	) {
		console.log(`[Webhook] Processing pull_request_review_comment.created event`);
		const commentBody = payload.comment?.body || "";
		const owner = payload.repository.owner.login;
		const repo = payload.repository.name;
		const pullNumber = payload.pull_request.number;
		const installationId = payload.installation?.id;
		const sender = payload.sender.login;
		const botName = getBotName(e);

		if (!installationId) {
			console.error("[Webhook] No installationId found in webhook payload");
			return c.text("OK", 200);
		}

		// ボット自身のコメントは無視する
		if (sender === botName || sender.includes("bot")) {
			console.log(`[Webhook] Ignored own review comment`);
			return c.text("OK", 200);
		}

		const commandCtx = {
			env: e,
			installationId,
			owner,
			repo,
			issueNumber: pullNumber,
			commentBody,
			commentId: payload.comment.id,
			botName,
			sender,
		};

		let routingTask: Promise<void> | undefined;

		// メンションが含まれているか、既存スレッドへの返信である場合にreplyCommandを実行
		if (commentBody.includes(`@${botName}`) || payload.comment.in_reply_to_id) {
			console.log(`[Webhook] Triggering replyCommand for review comment ${payload.comment.id}`);
			routingTask = replyCommand.execute(commandCtx).catch((err) =>
				console.error("Reply command failed critically", err),
			);
		} else {
			console.log(`[Webhook] Ignored review comment: no mention and not a reply`);
		}

		if (routingTask) {
			try {
				if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
					c.executionCtx.waitUntil(routingTask);
				}
			} catch {
				// fire and forget のまま
			}
		}
		console.log(`[Webhook] Finished processing pull_request_review_comment.created event`);
	} else if (
		eventName === "pull_request" &&
		payload.action === "synchronize"
	) {
		console.log(`[Webhook] Processing pull_request.synchronize event`);
		const owner = payload.repository.owner.login;
		const repo = payload.repository.name;
		const pullNumber = payload.pull_request.number;

		const kv = (e as any).KKYOSUKE_GITHUB_APP_KV;
		if (kv) {
			const cancelKey = `cancel-review-${owner}-${repo}-${pullNumber}`;
			console.log(`[Webhook] Setting cancellation flag for ${cancelKey}`);
			// 指定された時間(秒)間有効なキャンセルシグナルをセット
			await kv.put(cancelKey, "1", { expirationTtl: CANCEL_SIGNAL_TTL_SECONDS }).catch((err: any) => {
				console.error(`[Webhook] Failed to set cancellation flag:`, err);
			});
		} else {
			console.warn(`[Webhook] KV not found, cannot set cancellation flag`);
		}
	} else {
		console.log(
			`[Webhook] Ignored event: ${eventName}, action: ${payload.action}`,
		);
	}

	// GitHub Webhook に即座に200を返す
	return c.text("OK", 200);
}
