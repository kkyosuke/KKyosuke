import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { getFreeeConfig } from "../../config/env";
import { saveUserToken } from "../../datasource/db/userToken";
import { getDatabaseClient } from "../../lib/db";
import { createFreeeClient } from "../../lib/freee/index";
import { publishHomeView } from "../slack/app-home/index";

export async function handleFreeeAuthStart(
	c: Context<{ Bindings: Record<string, string | undefined> }>,
) {
	const userId = c.req.query("user_id");
	if (!userId) {
		return c.text("user_id parameter is required", 400);
	}

	return c.html(`
		<!DOCTYPE html>
		<html lang="ja">
		<head>
		  <meta charset="UTF-8">
		  <meta name="viewport" content="width=device-width, initial-scale=1.0">
		  <title>freeeへ遷移しています...</title>
		  <style>
		    body {
		      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
		      display: flex;
		      justify-content: center;
		      align-items: center;
		      height: 100vh;
		      margin: 0;
		      background-color: #f9fafb;
		      color: #111827;
		      text-align: center;
		    }
		    .spinner {
		      width: 40px;
		      height: 40px;
		      border: 4px solid #e5e7eb;
		      border-top: 4px solid #3b82f6; /* Tailwind blue-500 */
		      border-radius: 50%;
		      animation: spin 1s linear infinite;
		      margin: 0 auto 1rem auto;
		    }
		    @keyframes spin {
		      0% { transform: rotate(0deg); }
		      100% { transform: rotate(360deg); }
		    }
		    .container {
		      background: white;
		      padding: 3rem 2rem;
		      border-radius: 12px;
		      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		      max-width: 400px;
		      width: 90%;
		    }
		    h1 {
		      font-size: 1.25rem;
		      color: #4b5563;
		      margin-bottom: 0.5rem;
		    }
		  </style>
		</head>
		<body>
		  <div class="container">
		    <div class="spinner"></div>
		    <h1>freee人事労務へ遷移しています...</h1>
		    <p style="font-size: 0.875rem; color: #9ca3af;">そのまましばらくお待ちください</p>
		  </div>
		  <script>
		    // 1秒後に実際の認証エンドポイントへリダイレクト
		    setTimeout(function() {
		      window.location.href = "/freee/auth?user_id=" + encodeURIComponent("${userId}");
		    }, 1000);
		  </script>
		</body>
		</html>
	`);
}

export async function handleFreeeAuthRedirect(
	c: Context<{ Bindings: Record<string, string | undefined> }>,
) {
	const userId = c.req.query("user_id");
	if (!userId) {
		return c.text("user_id parameter is required", 400);
	}

	const config = getFreeeConfig(c.env as any);

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
	c: Context<{ Bindings: Record<string, string | undefined> }>,
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

	const config = getFreeeConfig(c.env as any);

	try {
		// 得られた認可コードを取得してアクセストークンを取得
		const freee = createFreeeClient(config);
		const tokenRes = await freee.getAccessToken(code);

		const db = getDatabaseClient(c.env as any);

		const expiresAt = tokenRes.expires_in
			? new Date(Date.now() + tokenRes.expires_in * 1000).toISOString()
			: null;

		// データベースにアクセストークンとリフレッシュトークンを保存
		await saveUserToken(db, userId, "freee", "refresh_token", tokenRes.refresh_token, expiresAt);
		await saveUserToken(db, userId, "freee", "access_token", tokenRes.access_token, expiresAt);

		// 連携が完了したのでSlackのホームタブを更新する
		await publishHomeView(userId, c.env as any);

		return c.html(`
			<!DOCTYPE html>
			<html lang="ja">
			<head>
			  <meta charset="UTF-8">
			  <meta name="viewport" content="width=device-width, initial-scale=1.0">
			  <title>認証完了</title>
			  <style>
			    body {
			      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			      display: flex;
			      justify-content: center;
			      align-items: center;
			      height: 100vh;
			      margin: 0;
			      background-color: #f9fafb;
			      color: #111827;
			      text-align: center;
			    }
			    .container {
			      background: white;
			      padding: 3rem 2rem;
			      border-radius: 12px;
			      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
			      max-width: 400px;
			      width: 90%;
			    }
			    h1 {
			      font-size: 1.5rem;
			      margin-bottom: 1rem;
			      color: #059669;
			    }
			    p {
			      margin-bottom: 0.5rem;
			      color: #4b5563;
			    }
			  </style>
			</head>
			<body>
			  <div class="container">
			    <h1>認証完了 🎉</h1>
			    <p>完了しました。アプリケーションに戻ってください。</p>
			    <p style="font-size: 0.875rem; color: #9ca3af; margin-top: 1.5rem;">このウィンドウは数秒後に自動的に閉じます。</p>
			  </div>
			  <script>
			    // 1秒後にSlackアプリを前面に呼び出す（OSのディープリンク機能を使用）
			    setTimeout(function() {
			      window.location.href = "slack://open";
			    }, 1000);

			    // その後、タブ自体を閉じる
			    setTimeout(function() {
			      window.close();
			    }, 3000);
			  </script>
			</body>
			</html>
		`);
	} catch (e: any) {
		console.error("Freee authentication error:", e);
		return c.text(`Authentication failed: ${e.message}`, 500);
	}
}
