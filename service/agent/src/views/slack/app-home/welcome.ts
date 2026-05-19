import type { AnyHomeTabBlock } from "slack-cloudflare-workers";

export function buildWelcomeBlocks(): AnyHomeTabBlock[] {
	return [
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
	];
}
