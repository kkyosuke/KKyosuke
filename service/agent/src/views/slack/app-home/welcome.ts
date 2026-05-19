import type { AnyHomeTabBlock } from "slack-cloudflare-workers";

export function buildWelcomeBlocks(): AnyHomeTabBlock[] {
	return [
		{
			type: "section",
			text: {
				type: "mrkdwn",
				text: "*🏠 kyosuke.ai Home*\nこの画面は Cloudflare Workers から動的に生成されています！\n• `/hey-cf-workers` で挨拶 | • メッセージタブから直接会話",
			},
		},
		{
			type: "divider",
		},
	];
}
