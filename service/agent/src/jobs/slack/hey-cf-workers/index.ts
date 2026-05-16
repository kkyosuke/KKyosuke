import type { SlackApp, SlackEdgeAppEnv } from "slack-cloudflare-workers";

type CommandHandlerArgs = Parameters<SlackApp<SlackEdgeAppEnv>["command"]>;
type AckFn = CommandHandlerArgs[1];
type LazyFn = NonNullable<CommandHandlerArgs[2]>;

export const heyCommandAck: AckFn = async (_req) => {
	// このテキストはアプリからのエフェメラルメッセージとして送信されます
	return "What's up?";
};

export const heyCommandLazy: LazyFn = async (req) => {
	await req.context.respond({
		text: "Hey! This is an async response!",
	});
};
