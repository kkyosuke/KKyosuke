import type { SlackEdgeAppEnv } from "slack-cloudflare-workers";
import type { AppBindings } from "../types/bindings";

export type CustomAppEnv = AppBindings & SlackEdgeAppEnv;

export function resolveEnv(envFallback?: unknown): CustomAppEnv {
	// Bun等での実行時は envFallback が存在しない、または別のオブジェクト(Server)の場合があるため process.env をフォールバックとして使う
	// Cloudflare Workers環境では process グローバル変数が存在しない可能性があるため、参照エラーを防ぐ目的で typeof process !== "undefined" を確認しています
	if (
		envFallback &&
		typeof envFallback === "object" &&
		"SLACK_BOT_TOKEN" in envFallback
	) {
		return envFallback as CustomAppEnv;
	}
	if (typeof process !== "undefined") {
		return process.env as unknown as CustomAppEnv;
	}
	return (envFallback as CustomAppEnv) || ({} as CustomAppEnv);
}

export function getBotName(env: Partial<CustomAppEnv>): string {
	const resolvedEnv = resolveEnv(env);
	// Cloudflare Workers環境では process グローバル変数が存在しない可能性があるため、
	// 参照エラーを防ぐ目的で typeof process !== "undefined" を確認しています。
	const isLocal =
		typeof process !== "undefined" && process.env.NODE_ENV !== "production";
	return resolvedEnv.BOT_NAME || (isLocal ? "test.kkyosuke.ai" : "kkyosuke.ai");
}

export function getFreeeConfig(env: Partial<CustomAppEnv>) {
	const resolvedEnv = resolveEnv(env);
	const appUrl = resolvedEnv.APP_URL || "http://localhost:3000";
	const config = {
		clientId: resolvedEnv.FREEE_CLIENT_ID || "",
		clientSecret: resolvedEnv.FREEE_CLIENT_SECRET || "",
		redirectUri: `${appUrl}/freee/auth/callback`,
	};

	if (!config.clientId || !config.redirectUri) {
		throw Error("Freee credentials are not configured");
	}

	return config;
}
