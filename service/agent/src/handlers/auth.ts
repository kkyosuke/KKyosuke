import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { resolveEnv } from "../config/env";
import { saveUserToken } from "../datasource/db/userToken";
import { getDatabaseClient } from "../lib/db";
import { Freee } from "../lib/freee";

export const authApp = new Hono<{ Bindings: Record<string, string | undefined> }>();

authApp.get("/freee", async (c) => {
	const userId = c.req.query("user_id");
	if (!userId) {
		return c.text("user_id parameter is required", 400);
	}

	const env = resolveEnv(c.env);
	const clientId = env.FREEE_CLIENT_ID;
	const redirectUri = env.FREEE_REDIRECT_URI;

	if (!clientId || !redirectUri) {
		return c.text("Freee credentials are not configured", 500);
	}

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

	const authUrl = Freee.getAuthorizationUrl(clientId, redirectUri, state);
	return c.redirect(authUrl);
});

authApp.get("/freee/callback", async (c) => {
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

	const env = resolveEnv(c.env);
	const clientId = env.FREEE_CLIENT_ID;
	const clientSecret = env.FREEE_CLIENT_SECRET;
	const redirectUri = env.FREEE_REDIRECT_URI;

	if (!clientId || !clientSecret || !redirectUri) {
		return c.text("Freee credentials are not configured", 500);
	}

	try {
		// 得られた認可コードを取得してアクセストークンを取得
		const tokenRes = await Freee.getAccessToken(
			clientId,
			clientSecret,
			code,
			redirectUri,
		);

		const db = getDatabaseClient(c.env as any);

		const expiresAt = tokenRes.expires_in
			? new Date(Date.now() + tokenRes.expires_in * 1000).toISOString()
			: null;

		// データベースにアクセストークンを保存
		await saveUserToken(db, userId, "freee", tokenRes.access_token, expiresAt);

		return c.text("認証が完了しました。アプリケーションに戻ってください。");
	} catch (e: any) {
		console.error("Freee authentication error:", e);
		return c.text(`Authentication failed: ${e.message}`, 500);
	}
});
