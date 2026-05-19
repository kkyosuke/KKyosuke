import type { AppBindings } from "../../types/bindings";

export interface KVClient {
	get(key: string): Promise<string | null>;
	put(
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	): Promise<void>;
	delete(key: string): Promise<void>;
}

export function getKVClient(env: Partial<AppBindings>): KVClient {
	if (env.AI_KYOSUKE_KV) {
		// Cloudflare KV
		return {
			async get(key: string) {
				return (await env.AI_KYOSUKE_KV?.get(key)) ?? null;
			},
			async put(
				key: string,
				value: string,
				options?: { expirationTtl?: number },
			) {
				await env.AI_KYOSUKE_KV?.put(key, value, options);
			},
			async delete(key: string) {
				await env.AI_KYOSUKE_KV?.delete(key);
			},
		};
	}

	// ローカル環境等でKVがバインドされていない場合、インメモリのモックを利用する
	const mod = "./memory";
	const { getMemoryKVClient } = require(mod);
	return getMemoryKVClient();
}
