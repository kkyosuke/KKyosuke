import { FreeeAPIError } from "./error";
import type { FreeeConfig } from "./index";

export interface FreeeTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	scope: string;
	created_at: number;
}

export function buildAuthFunction(config: FreeeConfig) {
	return {
		/**
		 * freeeの認可エンドポイントURLを生成します。
		 */
		getAuthorizationUrl(state: string): string {
			const params = new URLSearchParams({
				response_type: "code",
				client_id: config.clientId,
				redirect_uri: config.redirectUri,
				state: state,
				prompt: "select_company",
			});
			return `https://accounts.secure.freee.co.jp/public_api/authorize?${params.toString()}`;
		},

		/**
		 * 認可コードを利用してfreeeのアクセストークンを取得します。
		 */
		async getAccessToken(code: string): Promise<FreeeTokenResponse> {
			const params = new URLSearchParams({
				grant_type: "authorization_code",
				client_id: config.clientId,
				client_secret: config.clientSecret,
				code: code,
				redirect_uri: config.redirectUri,
			});

			const response = await fetch(
				"https://accounts.secure.freee.co.jp/public_api/token",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: params.toString(),
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				throw new FreeeAPIError(
					`Failed to get freee access token`,
					response.status,
					response.statusText,
					errorText,
				);
			}

			return (await response.json()) as FreeeTokenResponse;
		},

		/**
		 * リフレッシュトークンを利用してfreeeの新しいアクセストークンを取得します。
		 */
		async refreshAccessToken(
			refreshToken: string,
		): Promise<FreeeTokenResponse> {
			const params = new URLSearchParams({
				grant_type: "refresh_token",
				client_id: config.clientId,
				client_secret: config.clientSecret,
				refresh_token: refreshToken,
			});

			const response = await fetch(
				"https://accounts.secure.freee.co.jp/public_api/token",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: params.toString(),
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				throw new FreeeAPIError(
					`Failed to refresh freee access token`,
					response.status,
					response.statusText,
					errorText,
				);
			}

			return (await response.json()) as FreeeTokenResponse;
		},
	};
}
