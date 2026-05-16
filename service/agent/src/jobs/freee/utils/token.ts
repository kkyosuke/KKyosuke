import { getKVClient } from "../../../lib/kv";
import type { DBClient } from "../../../lib/db";
import { getUserTokenByType, saveUserToken } from "../../../datasource/db/userToken";
import { createFreeeClient } from "../../../lib/freee/index";
import { getFreeeConfig } from "../../../config/env";

/**
 * KVにfreeeのアクセストークンを保存します (TTL 10分)
 */
export async function saveAccessTokenToKV(env: Record<string, any>, userId: string, accessToken: string): Promise<void> {
	const kv = getKVClient(env);
	await kv.put(`freee:access_token:${userId}`, accessToken, { expirationTtl: 600 });
}

/**
 * KVからfreeeのアクセストークンを取得します
 */
export async function getAccessTokenFromKV(env: Record<string, any>, userId: string): Promise<string | null> {
	const kv = getKVClient(env);
	return await kv.get(`freee:access_token:${userId}`);
}

/**
 * 有効なアクセストークンを取得またはリフレッシュします
 */
export async function ensureFreeeAccessToken(db: DBClient, env: Record<string, any>, userId: string): Promise<string | null> {
	let accessToken = await getAccessTokenFromKV(env, userId);
	if (accessToken) return accessToken;

	const refreshTokenRow = await getUserTokenByType(db, userId, "freee", "refresh_token");
	if (!refreshTokenRow || !refreshTokenRow.token) return null;

	const config = getFreeeConfig(env as any);
	const freee = createFreeeClient(config);

	try {
		const tokenRes = await freee.refreshAccessToken(refreshTokenRow.token);
		accessToken = tokenRes.access_token;
		
		// refresh token expires in 90 days
		const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

		await saveUserToken(db, userId, "freee", "refresh_token", tokenRes.refresh_token, expiresAt);
		await saveAccessTokenToKV(env, userId, accessToken);
		
		return accessToken;
	} catch (e) {
		console.error("Failed to refresh token", e);
		return null;
	}
}
