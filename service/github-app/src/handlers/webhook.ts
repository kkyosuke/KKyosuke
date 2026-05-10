import type { Context } from "hono";
import { Webhooks } from "@octokit/webhooks";
import { env } from "../config/env";
import { runReviewAgent } from "../jobs/reviewAgent";

const webhooks = new Webhooks({
	secret: env.GITHUB_WEBHOOK_SECRET,
});

export async function githubWebhookHandler(c: Context) {
	const signature = c.req.header("x-hub-signature-256");
	const eventName = c.req.header("x-github-event");
	const id = c.req.header("x-github-delivery");

	if (!signature || !eventName || !id) {
		return c.text("Missing required GitHub headers", 400);
	}

	const rawBody = await c.req.text();

	try {
		// 署名検証
		const isValid = await webhooks.verify(rawBody, signature);
		if (!isValid) {
			return c.text("Invalid signature", 401);
		}
	} catch (error) {
		return c.text("Error verifying signature", 500);
	}

	// ペイロードのパース
	let payload: any;
	try {
		payload = JSON.parse(rawBody);
	} catch (e) {
		return c.text("Invalid JSON", 400);
	}

	// 条件判定: issue_comment (PR含む) かつ action === 'created'
	if (eventName === "issue_comment" && payload.action === "created") {
		// PRへのコメントであることの確認
		if (payload.issue && payload.issue.pull_request) {
			const commentBody = payload.comment?.body || "";

			// トリガー文字列の確認
			if (commentBody.includes("レビューして")) {
				const owner = payload.repository.owner.login;
				const repo = payload.repository.name;
				const pullNumber = payload.issue.number;
				const installationId = payload.installation?.id;

				if (!installationId) {
					console.error("No installationId found in webhook payload");
					return c.text("OK", 200);
				}

				console.log(`[Webhook] Triggering review for ${owner}/${repo}#${pullNumber} (Installation: ${installationId})`);

				// 非同期でレビューを実行 (Fire and forget)
				// ※ 本番環境で実行が途切れる可能性がある場合は、キューなどの導入を検討します
				Promise.resolve()
					.then(() => runReviewAgent(installationId, owner, repo, pullNumber))
					.catch((e) => console.error("Agent failed critically", e));
			}
		}
	}

	// GitHub Webhook に即座に200を返す
	return c.text("OK", 200);
}
