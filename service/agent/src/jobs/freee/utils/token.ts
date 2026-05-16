import { getKVClient } from "../../../lib/kv";

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
