import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { CustomAppEnv } from "../../config/env";
import { getFreeeConfig } from "../../config/env";
import { saveUserToken } from "../../datasource/db/userToken";
import { getDatabaseClient } from "../../lib/db";
import { createFreeeClient } from "../../lib/freee/index";
import freeeAuthCallbackHtml from "../../resources/freee-auth-callback.html";
import freeeAuthStartHtml from "../../resources/freee-auth-start.html";
import { publishHomeView } from "../../views/slack/app-home";
import { saveAccessTokenToKV } from "./utils/token";

export async function handleFreeeAuthStart(
	c: Context<{ Bindings: CustomAppEnv }>,
) {
	const userId = c.req.query("user_id");
	if (!userId) {
		return c.text("user_id parameter is required", 400);
	}

	const rawHtml =
		typeof freeeAuthStartHtml === "string"
			? freeeAuthStartHtml
			: (freeeAuthStartHtml as { default?: string }).default ||
				String(freeeAuthStartHtml);

	return c.html(rawHtml.replace("{{userId}}", userId));
}

export async function handleFreeeAuthRedirect(
	c: Context<{ Bindings: CustomAppEnv }>,
) {
	const userId = c.req.query("user_id");
	if (!userId) {
		return c.text("user_id parameter is required", 400);
	}

	const config = getFreeeConfig(c.env);

	// stateにユーザーIDを含めるか、Cookieで管理する
	// CSRF対策としてランダムな文字列を生成し、ユーザーIDと組み合わせる
	const randomStr = crypto.randomUUID();
	const state = `${userId}:${randomStr}`;

	setCookie(c, "freee_auth_state", state, {
		httpOnly: true,
		secure: true, // HTTPSが必須になるため、ローカル開発環境でHTTPSが使えない場合は注意
		sameSite: "Lax",
		maxAge: 60 * 10, // 10 minutes
	});

	const freee = createFreeeClient(config);
	const authUrl = freee.getAuthorizationUrl(state);
	return c.redirect(authUrl);
}

export async function handleFreeeAuthCallback(
	c: Context<{ Bindings: CustomAppEnv }>,
) {
	const code = c.req.query("code");
	const state = c.req.query("state");
	const savedState = getCookie(c, "freee_auth_state");

	if (!code || !state) {
		return c.text("Missing code or state parameter", 400);
	}

	// クライアント側で認可リクエスト時に指定したstateがリダイレクト時に返却されたstateパラメータと一致しているかチェック
	if (state !== savedState) {
		return c.text("Invalid state parameter (CSRF check failed)", 400);
	}

	// userIdをstateから取り出す (userId:randomStr)
	const [userId] = state.split(":");
	if (!userId) {
		return c.text("Invalid state format", 400);
	}

	const config = getFreeeConfig(c.env);

	try {
		// 得られた認可コードを取得してアクセストークンを取得
		const freee = createFreeeClient(config);
		const tokenRes = await freee.getAccessToken(code);

		const db = getDatabaseClient(c.env);

		// refresh token expires in 90 days
		const expiresAt = new Date(
			Date.now() + 90 * 24 * 60 * 60 * 1000,
		).toISOString();

		// データベースにはリフレッシュトークンのみ保存
		await saveUserToken(
			db,
			userId,
			"freee",
			"refresh_token",
			tokenRes.refresh_token,
			expiresAt,
		);

		// KVにアクセストークンを保存 (TTL 10分)
		await saveAccessTokenToKV(c.env, userId, tokenRes.access_token);

		// 連携が完了したのでSlackのホームタブを更新する
		await publishHomeView(userId, c.env);

		const rawHtml =
			typeof freeeAuthCallbackHtml === "string"
				? freeeAuthCallbackHtml
				: (freeeAuthCallbackHtml as { default?: string }).default ||
					String(freeeAuthCallbackHtml);

		return c.html(rawHtml);
	} catch (e: unknown) {
		const err = e instanceof Error ? e : new Error(String(e));
		console.error("Freee authentication error:", err);
		return c.text(`Authentication failed: ${err.message}`, 500);
	}
}
