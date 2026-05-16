export interface FreeeTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	scope: string;
	created_at: number;
}

/**
 * freeeの認可エンドポイントURLを生成します。
 */
export function getAuthorizationUrl(
	clientId: string,
	redirectUri: string,
	state: string,
): string {
	const params = new URLSearchParams({
		response_type: "code",
		client_id: clientId,
		redirect_uri: redirectUri,
		state: state,
		prompt: "select_company",
	});
	return `https://accounts.secure.freee.co.jp/public_api/authorize?${params.toString()}`;
}

/**
 * 認可コードを利用してfreeeのアクセストークンを取得します。
 */
export async function getAccessToken(
	clientId: string,
	clientSecret: string,
	code: string,
	redirectUri: string,
): Promise<FreeeTokenResponse> {
	const params = new URLSearchParams({
		grant_type: "authorization_code",
		client_id: clientId,
		client_secret: clientSecret,
		code: code,
		redirect_uri: redirectUri,
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
		throw new Error(
			`Failed to get freee access token: ${response.status} ${response.statusText} - ${errorText}`,
		);
	}

	return (await response.json()) as FreeeTokenResponse;
}

/**
 * リフレッシュトークンを利用してfreeeの新しいアクセストークンを取得します。
 */
export async function refreshAccessToken(
	clientId: string,
	clientSecret: string,
	refreshToken: string,
	redirectUri: string,
): Promise<FreeeTokenResponse> {
	const params = new URLSearchParams({
		grant_type: "refresh_token",
		client_id: clientId,
		client_secret: clientSecret,
		refresh_token: refreshToken,
		redirect_uri: redirectUri,
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
		throw new Error(
			`Failed to refresh freee access token: ${response.status} ${response.statusText} - ${errorText}`,
		);
	}

	return (await response.json()) as FreeeTokenResponse;
}
