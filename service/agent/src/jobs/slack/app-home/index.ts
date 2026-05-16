import type { SlackApp, SlackEdgeAppEnv, AnyHomeTabBlock } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../../handlers/slack";
import { buildWelcomeBlocks } from "./welcome";
import { buildAttendanceBlocks } from "./attendance";
import { getDatabaseClient } from "../../../lib/db";

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
		...(await buildAttendanceBlocks(db, userId, env as any)),
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
			],
		},
	];

	const slackToken = env.SLACK_BOT_TOKEN;
	if (slackToken) {
		await fetch("https://slack.com/api/views.publish", {
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
	}
}
