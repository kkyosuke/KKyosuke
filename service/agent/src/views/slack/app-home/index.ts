import type { AnyHomeTabBlock } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../../config/env";
import { getDatabaseClient } from "../../../lib/db";
import { buildFreeeBlocks } from "./freee";
import { buildSettingsBlocks } from "./settings";
import { buildWelcomeBlocks } from "./welcome";

export async function publishHomeView(userId: string, env: CustomAppEnv) {
	const db = getDatabaseClient(env);

	const blocks: AnyHomeTabBlock[] = [
		...buildWelcomeBlocks(),
		...(await buildFreeeBlocks(db, userId, env)),
		...(await buildSettingsBlocks(userId, env)),
		{
			type: "divider",
		},
		{
			type: "context",
			elements: [
				{
					type: "plain_text",
					text: "This is a sample home tab powered by slack-cloudflare-workers",
					emoji: true,
				},
				{
					type: "mrkdwn",
					text: `<${env.APP_URL}|AI Dashboard>`,
				},
			],
		},
	];

	const slackToken = env.SLACK_BOT_TOKEN;
	if (slackToken) {
		const res = await fetch("https://slack.com/api/views.publish", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${slackToken}`,
			},
			body: JSON.stringify({
				user_id: userId,
				view: {
					type: "home",
					blocks,
				},
			}),
		});
		const data = (await res.json()) as { ok: boolean };
		if (!data.ok) {
			console.error(
				"Failed to publish home view:",
				JSON.stringify(data, null, 2),
			);
		}
	}
}
