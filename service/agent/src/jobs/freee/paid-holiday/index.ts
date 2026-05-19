import type { CustomAppEnv } from "../../../config/env";
import { getFreeeConfig } from "../../../config/env";
import type { DBClient } from "../../../lib/db";
import type { PaidHolidayRequest } from "../../../lib/freee/hr";
import { createFreeeClient } from "../../../lib/freee/index";
import { ensureFreeeAccessToken } from "../utils/token";

export interface PaidHolidayModalContext {
	companyId: number;
	employeeId: number;
	approvalFlowId: number;
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

	const flows = await freee.hr.getApprovalFlows(accessToken, company.id);
	if (flows.length === 0) {
		throw new Error(
			"申請経路が見つかりませんでした。freee人事労務の設定をご確認ください。",
		);
	}

	const defaultFlow = flows[0];
	if (!defaultFlow) {
		throw new Error(
			"申請経路が見つかりませんでした。freee人事労務の設定をご確認ください。",
		);
	}

	return {
		companyId: company.id,
		employeeId: company.employee_id,
		approvalFlowId: defaultFlow.id,
	};
}

export interface SubmitPaidHolidayParams {
	companyId: number;
	employeeId: number;
	approvalFlowId: number;
	leaveType: string;
	startDate: string;
	endDate: string;
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

	await freee.hr.postPaidHolidayRequest(accessToken, {
		company_id: params.companyId,
		applicant_id: params.employeeId,
		approval_flow_id: params.approvalFlowId,
		values: {
			type: params.leaveType as PaidHolidayRequest["values"]["type"],
			start_date: params.startDate,
			end_date: params.endDate,
			reason: params.reason,
		},
	});
}
