import type { KVNamespace } from "@cloudflare/workers-types";

export interface KVClient {
	get(key: string): Promise<string | null>;
	put(
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	): Promise<void>;
}

export function getKVClient(env: { GITHUB_KV?: KVNamespace }): KVClient {
	if (env.GITHUB_KV) {
		// Cloudflare KV
		return {
			async get(key: string) {
				return await env.GITHUB_KV!.get(key);
			},
			async put(
				key: string,
				value: string,
				options?: { expirationTtl?: number },
			) {
				await env.GITHUB_KV!.put(key, value, options);
			},
		};
	}

	// ローカル環境等でKVがバインドされていない場合、インメモリのモックを利用する
	const mod = "./memory";
	const { getMemoryKVClient } = require(mod);
	return getMemoryKVClient();
}
