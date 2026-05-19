import type { CustomAppEnv } from "../../../config/env";
import { getKVClient } from "../../../lib/kv";

/**
 * KVを使用した排他制御を行います。
 */
export async function withKvLock(
	env: Partial<CustomAppEnv>,
	key: string,
	ttlSeconds: number,
	callback: () => Promise<void>,
) {
	const kv = getKVClient(env);

	const isLocked = await kv.get(key);
	if (isLocked) {
		console.log(`[Lock] Operation already running for key: ${key}. Skipping.`);
		return;
	}

	try {
		await kv.put(key, "1", { expirationTtl: ttlSeconds });
		await callback();
	} finally {
		await kv
			.delete(key)
			.catch((e: unknown) =>
				console.error(`[Lock] Failed to delete KV lock for ${key}:`, e),
			);
	}
}
