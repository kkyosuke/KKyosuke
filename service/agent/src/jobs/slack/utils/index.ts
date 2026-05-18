import type { SlackMentionCommand, SlackMentionContext } from "../types";

const REACTIONS = {
	RUNNING_PIKACHU: "running-pikachu",
	SUCCESS: "white_check_mark",
	FAILURE: "x",
} as const;

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
			name: REACTIONS.RUNNING_PIKACHU,
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
				name: REACTIONS.RUNNING_PIKACHU,
			});
			await client.reactions.add({
				channel: channelId,
				timestamp: ts,
				name: REACTIONS.SUCCESS,
			});
		} catch (e) {
			console.error("[SlackRouter] Failed to update reaction to success", e);
		}
	} catch (error) {
		try {
			await client.reactions.remove({
				channel: channelId,
				timestamp: ts,
				name: REACTIONS.RUNNING_PIKACHU,
			});
			await client.reactions.add({
				channel: channelId,
				timestamp: ts,
				name: REACTIONS.FAILURE,
			});
		} catch (e) {
			console.error("[SlackRouter] Failed to update reaction to failure", e);
		}
		throw error;
	}
};
