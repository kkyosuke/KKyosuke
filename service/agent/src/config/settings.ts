import { DEFAULT_REVIEW_MODEL_NAME } from "../lib/llm/cost";
import type { CustomAppEnv } from "./env";

export class SettingsManager {
	constructor(private env: Partial<CustomAppEnv>) {}

	// --- 環境変数 (Environment Variables) ---

	get slackBotToken(): string | undefined {
		return this.env.SLACK_BOT_TOKEN;
	}

	get anthropicApiKey(): string | undefined {
		return this.env.ANTHROPIC_API_KEY;
	}

	get githubAppId(): string | undefined {
		return this.env.GITHUB_APP_ID;
	}

	get database() {
		return this.env.AI_KYOSUKE_DB;
	}

	// 元の env オブジェクトへのフォールバック用（他の関数で必要な場合）
	get rawEnv(): Partial<CustomAppEnv> {
		return this.env;
	}

	// --- KVを使用する動的設定 ---

	async getReviewModel(): Promise<string> {
		if (this.env.GITHUB_KV) {
			const model = await this.env.GITHUB_KV.get(
				"pr_review:global:default_model",
			);
			if (model) return model;
		}
		return DEFAULT_REVIEW_MODEL_NAME;
	}

	async setReviewModel(model: string): Promise<void> {
		if (this.env.GITHUB_KV) {
			await this.env.GITHUB_KV.put("pr_review:global:default_model", model);
		}
	}

	async isAutoReviewEnabled(): Promise<boolean> {
		if (this.env.GITHUB_KV) {
			const auto = await this.env.GITHUB_KV.get(
				"pr_review:global:auto_review_enabled",
			);
			if (auto === "false") return false;
		}
		return true;
	}

	async setAutoReviewEnabled(enabled: boolean): Promise<void> {
		if (this.env.GITHUB_KV) {
			await this.env.GITHUB_KV.put(
				"pr_review:global:auto_review_enabled",
				enabled ? "true" : "false",
			);
		}
	}

	async getLogLevel(): Promise<string> {
		if (this.env.GITHUB_KV) {
			const level = await this.env.GITHUB_KV.get("pr_review:global:log_level");
			if (level) return level;
		}
		return "info";
	}

	async setLogLevel(level: string): Promise<void> {
		if (this.env.GITHUB_KV) {
			await this.env.GITHUB_KV.put("pr_review:global:log_level", level);
		}
	}
}
