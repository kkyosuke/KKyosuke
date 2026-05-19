import type { SlackApp } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../../config/env";
import { publishHomeView } from "../../../views/slack/app-home";

export const appHomeOpened = async (
	req: Parameters<Parameters<SlackApp<CustomAppEnv>["event"]>[1]>[0],
) => {
	const { payload, env } = req;
	const p = payload as { user?: string; event?: { user?: string } };
	const userId = p.user || p.event?.user || "";

	await publishHomeView(userId, env);
};
