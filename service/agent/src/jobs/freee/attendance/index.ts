import type { DBClient } from "../../../lib/db";
import { getUserTokenByType, saveUserToken } from "../../../datasource/db/userToken";
import { createFreeeClient } from "../../../lib/freee/index";
import { getFreeeConfig } from "../../../config/env";

import { getAccessTokenFromKV, saveAccessTokenToKV } from "../utils/token";

export async function recordAttendance(
	db: DBClient,
	userId: string,
	env: Record<string, string | undefined>,
	type: "clock_in" | "clock_out" | "break_begin" | "break_end",
) {
	// 1. Get user access token from KV
	let accessToken = await getAccessTokenFromKV(env, userId);

	const config = getFreeeConfig(env as any);
	const freee = createFreeeClient(config);

	if (!accessToken) {
		// Try to refresh token
		const refreshToken = await getUserTokenByType(db, userId, "freee", "refresh_token");
		if (!refreshToken) {
			throw new Error("Freee is not linked for this user (no refresh token).");
		}

		try {
			const tokenRes = await freee.refreshAccessToken(refreshToken);
			accessToken = tokenRes.access_token;
			
			const expiresAt = tokenRes.expires_in
				? new Date(Date.now() + tokenRes.expires_in * 1000).toISOString()
				: null;

			// Save new refresh token to DB
			await saveUserToken(db, userId, "freee", "refresh_token", tokenRes.refresh_token, expiresAt);
			
			// Save new access token to KV
			await saveAccessTokenToKV(env, userId, accessToken);
		} catch (e) {
			console.error("Failed to refresh token", e);
			throw new Error("Failed to authenticate with freee. Please re-link your account.");
		}
	}

	// 2. Get company_id and employee_id
	const me = await freee.hr.getMe(accessToken);
	if (!me.companies || me.companies.length === 0) {
		throw new Error("User does not belong to any companies in freee HR.");
	}

	// Assuming the user belongs to the first company.
	// For users belonging to multiple companies, this might need selection.
	const company = me.companies?.[0];
	if (!company) {
		throw new Error("Company not found for the user in freee HR.");
	}
	const companyId = company.id;
	const employeeId = company.employee_id;

	if (!employeeId) {
		throw new Error("Employee ID not found for the user in freee HR.");
	}

	// 3. Post time clock
	await freee.hr.postTimeClock(accessToken, employeeId, companyId, type);
}
