import type { SlackApp } from "slack-cloudflare-workers";
import type { CustomAppEnv } from "../../handlers/slack";

export type SlackEventRequest = Parameters<
	Parameters<SlackApp<CustomAppEnv>["event"]>[1]
>[0];

export interface SlackMentionContext {
	req: SlackEventRequest;
	text: string;
	channelId: string;
	threadTs: string;
}

export interface SlackMentionCommand {
	name: string;
	triggerWords: string[]; // このコマンドが反応するキーワード
	priority?: number; // 判定の優先順位（大きいほど優先）
	execute: (ctx: SlackMentionContext) => Promise<void>;
}
