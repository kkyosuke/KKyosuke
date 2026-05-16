import type { SlackApp, SlackEdgeAppEnv, AnyHomeTabBlock } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../../handlers/slack";
import { buildWelcomeBlocks } from "./welcome";
import { buildAttendanceBlocks } from "./attendance";
import { getDatabaseClient } from "../../../lib/db";

export const appHomeOpened = async (
	req: Parameters<Parameters<SlackApp<CustomAppEnv>["event"]>[1]>[0],
) => {
	const { context, payload, env } = req;
	const p = payload as { user?: string; event?: { user?: string } };
	const userId = p.user || p.event?.user || "";

	const db = getDatabaseClient(env);

	const blocks: AnyHomeTabBlock[] = [
		...buildWelcomeBlocks(),
		...(await buildAttendanceBlocks(db, userId)),
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

	await context.client.views.publish({
		user_id: userId,
		view: {
			type: "home",
			blocks,
		},
	});
};
