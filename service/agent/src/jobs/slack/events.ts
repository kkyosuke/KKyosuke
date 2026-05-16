import type { SlackApp, SlackEdgeAppEnv } from "slack-cloudflare-workers";

export const appHomeOpened = async ({
	context,
	payload,
}: Parameters<Parameters<SlackApp<SlackEdgeAppEnv>["event"]>[1]>[0]) => {
	// @ts-ignore
	const userId = payload.user || payload.event?.user;
	await context.client.views.publish({
		user_id: userId,
		view: {
			type: "home",
			blocks: [
				{
					type: "header",
					text: {
						type: "plain_text",
						text: "Welcome to kyosuke.ai Home! 🏠",
						emoji: true,
					},
				},
				{
					type: "section",
					text: {
						type: "mrkdwn",
						text: "ここはボットのホームタブです。この画面は Cloudflare Workers から動的に生成されています！\n\n*できること:*\n• `/hey-cf-workers` コマンドで挨拶\n• メッセージタブから直接会話",
					},
				},
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
			],
		},
	});
};
