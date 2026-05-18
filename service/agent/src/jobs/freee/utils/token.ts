import { getFreeeConfig } from "../../../config/env";
import { FreeeAPIError } from "../../../lib/freee/error";
import {
	getUserTokenByType,
	saveUserToken,
} from "../../../datasource/db/userToken";
import type { DBClient } from "../../../lib/db";
import { createFreeeClient } from "../../../lib/freee/index";
import { getKVClient } from "../../../lib/kv";

import type { CustomAppEnv } from "../../../config/env";

/**
 * KVにfreeeのアクセストークンを保存します
 */
export async function saveAccessTokenToKV(
	env: Partial<CustomAppEnv>,
	userId: string,
	accessToken: string,
	expiresIn: number = 600,
): Promise<void> {
	const kv = getKVClient(env);
	await kv.put(`freee:access_token:${userId}`, accessToken, {
		expirationTtl: expiresIn,
	});
}

/**
 * KVからfreeeのアクセストークンを取得します
 */
export async function getAccessTokenFromKV(
	env: Partial<CustomAppEnv>,
	userId: string,
): Promise<string | null> {
	const kv = getKVClient(env);
	return await kv.get(`freee:access_token:${userId}`);
}

/**
 * 有効なアクセストークンを取得またはリフレッシュします
 */
export async function ensureFreeeAccessToken(
	db: DBClient,
	env: Partial<CustomAppEnv>,
	userId: string,
): Promise<string | null> {
	let accessToken = await getAccessTokenFromKV(env, userId);
	if (accessToken) return accessToken;

	const refreshTokenRow = await getUserTokenByType(
		db,
		userId,
		"freee",
		"refresh_token",
	);
	if (!refreshTokenRow?.token) return null;

	const config = getFreeeConfig(env);
	const freee = createFreeeClient(config);

	try {
		const tokenRes = await freee.refreshAccessToken(refreshTokenRow.token);
		accessToken = tokenRes.access_token;

		// refresh token expires in 90 days
		const expiresAt = new Date(
			Date.now() + 90 * 24 * 60 * 60 * 1000,
		).toISOString();

		await saveUserToken(
			db,
			userId,
			"freee",
			"refresh_token",
			tokenRes.refresh_token,
			expiresAt,
		);
		await saveAccessTokenToKV(env, userId, accessToken, tokenRes.expires_in);

		return accessToken;
	} catch (e) {
		console.error("Failed to refresh token", e);
		if (e instanceof FreeeAPIError) {
			if (e.status >= 400 && e.status < 500) {
				// トークンが無効・期限切れなどの場合はnullを返す
				return null;
			}
		}
		// 503などのサーバーエラーやネットワークエラーの場合は例外を投げる
		throw e;
	}
}
