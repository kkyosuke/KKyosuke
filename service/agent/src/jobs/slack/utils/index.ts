import type { SlackMentionCommand, SlackMentionContext } from "../types";

export const executeWithReaction = async (
	ctx: SlackMentionContext,
	command: SlackMentionCommand,
) => {
	const { req, channelId } = ctx;
	const payload = req.payload as { ts?: string };
	const ts = payload.ts;

	if (!ts) {
		await command.execute(ctx);
		return;
	}

	const client = req.context.client;

	try {
		await client.reactions.add({
			channel: channelId,
			timestamp: ts,
			name: "running",
		});
	} catch (e) {
		console.error("[SlackRouter] Failed to add running reaction", e);
	}

	try {
		await command.execute(ctx);

		try {
			await client.reactions.remove({
				channel: channelId,
				timestamp: ts,
				name: "running-pikachu",
			});
			await client.reactions.add({
				channel: channelId,
				timestamp: ts,
				name: "white_check_mark",
			});
		} catch (e) {
			console.error("[SlackRouter] Failed to update reaction to success", e);
		}
	} catch (error) {
		try {
			await client.reactions.remove({
				channel: channelId,
				timestamp: ts,
				name: "running-pikachu",
			});
			await client.reactions.add({
				channel: channelId,
				timestamp: ts,
				name: "x",
			});
		} catch (e) {
			console.error("[SlackRouter] Failed to update reaction to failure", e);
		}
		throw error;
	}
};
