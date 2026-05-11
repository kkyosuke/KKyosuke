import { Webhooks } from "@octokit/webhooks";
import type { Context } from "hono";
import { env } from "hono/adapter";
import { runReviewAgent } from "../jobs/reviewAgent";

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

	// 条件判定: issue_comment (PR含む) かつ action === 'created'
	if (eventName === "issue_comment" && payload.action === "created") {
		console.log(`[Webhook] Processing issue_comment.created event`);
		// PRへのコメントであることの確認
		if (payload.issue && payload.issue.pull_request) {
			const commentBody = payload.comment?.body || "";

			// トリガー文字列の確認
			if (
				commentBody.includes("@kkyosuke.ai") &&
				commentBody.includes("レビューして")
			) {
				const owner = payload.repository.owner.login;
				const repo = payload.repository.name;
				const pullNumber = payload.issue.number;
				const installationId = payload.installation?.id;

				if (!installationId) {
					console.error("[Webhook] No installationId found in webhook payload");
					return c.text("OK", 200);
				}

				console.log(
					`[Webhook] Triggering review for ${owner}/${repo}#${pullNumber} (Installation: ${installationId})`,
				);

				// 非同期でレビューを実行 (Fire and forget / Background task)
				const reviewTask = Promise.resolve()
					.then(() =>
						runReviewAgent(e, installationId, owner, repo, pullNumber),
					)
					.catch((err) => console.error("Agent failed critically", err));

				if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
					// Cloudflare Workers 等でのバックグラウンド実行
					c.executionCtx.waitUntil(reviewTask);
				} else {
					// ローカル Bun 環境など
					// fire and forget のまま
				}
			} else {
				console.log(
					`[Webhook] Ignored comment: does not include both '@kkyosuke.ai' and 'レビューして'. Body: "${commentBody.slice(0, 20)}..."`,
				);
			}
		} else {
			console.log(`[Webhook] Ignored comment: not a pull request issue`);
		}
	} else {
		console.log(
			`[Webhook] Ignored event: ${eventName}, action: ${payload.action}`,
		);
	}

	// GitHub Webhook に即座に200を返す
	return c.text("OK", 200);
}
