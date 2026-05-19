import type { CustomAppEnv } from "../../../config/env";
import { getFreeeConfig } from "../../../config/env";
import type { DBClient } from "../../../lib/db";
import type { PaidHolidayRequest } from "../../../lib/freee/hr";
import { createFreeeClient } from "../../../lib/freee/index";
import { ensureFreeeAccessToken } from "../utils/token";

export interface PaidHolidayModalContext {
	companyId: number;
	employeeId: number;
}

export async function getPaidHolidayModalContext(
	db: DBClient,
	env: Partial<CustomAppEnv>,
	userId: string,
): Promise<PaidHolidayModalContext | null> {
	const accessToken = await ensureFreeeAccessToken(db, env, userId);
	if (!accessToken) {
		return null;
	}

	const config = getFreeeConfig(env);
	const freee = createFreeeClient(config);

	const me = await freee.hr.getMe(accessToken);
	const company = me.companies?.[0];
	if (!company) {
		throw new Error("User has no company in freee");
	}

	return {
		companyId: company.id,
		employeeId: company.employee_id,
	};
}

export interface SubmitPaidHolidayParams {
	companyId: number;
	employeeId: number;
	approvalFlowId: number;
	leaveType: string;
	targetDate: string;
	startTime?: string;
	endTime?: string;
	reason: string;
}

export async function submitPaidHoliday(
	db: DBClient,
	env: Partial<CustomAppEnv>,
	userId: string,
	params: SubmitPaidHolidayParams,
): Promise<void> {
	const accessToken = await ensureFreeeAccessToken(db, env, userId);
	if (!accessToken) {
		throw new Error("Freee access token not found for user");
	}

	const config = getFreeeConfig(env);
	const freee = createFreeeClient(config);

	let apiType = params.leaveType;
	if (apiType === "morning_off") apiType = "morning";
	if (apiType === "afternoon_off") apiType = "afternoon";
	if (apiType === "hour") apiType = "hourly";

	const valuePayload: PaidHolidayRequest["values"][0] = {
		type: apiType as PaidHolidayRequest["values"][0]["type"],
	};
	if (params.startTime) {
		valuePayload.start_at = params.startTime;
	}
	if (params.endTime) {
		valuePayload.end_at = params.endTime;
	}

	await freee.hr.postPaidHolidayRequest(accessToken, {
		company_id: params.companyId,
		target_date: params.targetDate,
		approval_flow_route_id: params.approvalFlowId,
		values: [valuePayload],
		comment: params.reason,
	});
}
