/**
 * KVを使用した排他制御を行います。
 */
export async function withKvLock(
	env: Record<string, string | undefined>,
	key: string,
	ttlSeconds: number,
	callback: () => Promise<void>,
) {
	const kv = (env as any).KKYOSUKE_GITHUB_APP_KV;
	if (!kv) {
		// KVが設定されていない場合はそのまま実行
		await callback();
		return;
	}

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
			.catch((e: any) =>
				console.error(`[Lock] Failed to delete KV lock for ${key}:`, e),
			);
	}
}
