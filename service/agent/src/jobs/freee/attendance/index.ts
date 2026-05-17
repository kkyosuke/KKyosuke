import { getFreeeConfig } from "../../../config/env";
import {
	getUserTokenByType,
	saveUserToken,
} from "../../../datasource/db/userToken";
import type { DBClient } from "../../../lib/db";
import { createFreeeClient } from "../../../lib/freee/index";

import {
	ensureFreeeAccessToken,
	getAccessTokenFromKV,
	saveAccessTokenToKV,
} from "../utils/token";

export async function recordAttendance(
	db: DBClient,
	userId: string,
	env: Record<string, string | undefined>,
	type: "clock_in" | "clock_out" | "break_begin" | "break_end",
) {
	// 1. Get user access token from KV or refresh it
	const accessToken = await ensureFreeeAccessToken(db, env as any, userId);
	if (!accessToken) {
		throw new Error(
			"Failed to authenticate with freee. Please re-link your account.",
		);
	}

	const config = getFreeeConfig(env as any);
	const freee = createFreeeClient(config);

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
