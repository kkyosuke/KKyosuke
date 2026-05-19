import type { AnyHomeTabBlock, SlackApp } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../../config/env";
import { getDatabaseClient } from "../../../lib/db";
import { buildFreeeBlocks } from "./freee";
import { buildWelcomeBlocks } from "./welcome";

export const appHomeOpened = async (
	req: Parameters<Parameters<SlackApp<CustomAppEnv>["event"]>[1]>[0],
) => {
	const { payload, env } = req;
	const p = payload as { user?: string; event?: { user?: string } };
	const userId = p.user || p.event?.user || "";

	await publishHomeView(userId, env);
};

export async function publishHomeView(userId: string, env: CustomAppEnv) {
	const db = getDatabaseClient(env);

	const blocks: AnyHomeTabBlock[] = [
		...buildWelcomeBlocks(),
		...(await buildFreeeBlocks(db, userId, env)),
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
		if (!res.ok) {
			console.error("Failed to publish home view:", await res.text());
		}
	}
}
