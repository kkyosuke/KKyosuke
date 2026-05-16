import type { SlackEdgeAppEnv } from "slack-cloudflare-workers";
import { SlackApp } from "slack-cloudflare-workers";

export function createSlackApp(
	env: SlackEdgeAppEnv,
): SlackApp<SlackEdgeAppEnv> {
	const app = new SlackApp({ env });

	app.command(
		"/hey-cf-workers",
		// "ack" 関数は 3 秒以内に完了する必要があります
		async (_req) => {
			// このテキストはアプリからのエフェメラルメッセージとして送信されます
			return "What's up?";
		},
		// "lazy" 関数では 3 秒の制約はなく、非同期で実行したい処理を何でもできます
		async (req) => {
			await req.context.respond({
				text: "Hey! This is an async response!",
			});
		},
	);

	return app;
}
