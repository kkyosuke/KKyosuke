import { FreeeAPIError } from "./error";

export interface FreeeMeResponse {
	id: number;
	companies: {
		id: number;
		name: string;
		role: string;
		external_cid?: string;
		employee_id: number;
		display_name?: string;
	}[];
}

export async function getMe(accessToken: string): Promise<FreeeMeResponse> {
	const response = await fetch("https://api.freee.co.jp/hr/api/v1/users/me", {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new FreeeAPIError(
			"Failed to get user info from freee",
			response.status,
			response.statusText,
			errorText,
		);
	}

	return (await response.json()) as FreeeMeResponse;
}

export async function postTimeClock(
	accessToken: string,
	employeeId: number,
	companyId: number,
	type: "clock_in" | "clock_out" | "break_begin" | "break_end",
	baseDate?: string,
): Promise<void> {
	const body: Record<string, string | number> = {
		company_id: companyId,
		type: type,
	};
	if (baseDate) {
		body.base_date = baseDate;
	}

	const response = await fetch(
		`https://api.freee.co.jp/hr/api/v1/employees/${employeeId}/time_clocks`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(body),
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new FreeeAPIError(
			"Failed to post time clock to freee",
			response.status,
			response.statusText,
			errorText,
		);
	}
}

export interface AvailableTimeClocksResponse {
	available_types: ("clock_in" | "break_begin" | "break_end" | "clock_out")[];
	base_date: string;
}

export async function getAvailableTimeClockTypes(
	accessToken: string,
	employeeId: number,
	companyId: number,
): Promise<AvailableTimeClocksResponse> {
	const response = await fetch(
		`https://api.freee.co.jp/hr/api/v1/employees/${employeeId}/time_clocks/available_types?company_id=${companyId}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json",
			},
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new FreeeAPIError(
			"Failed to get available time clock types from freee",
			response.status,
			response.statusText,
			errorText,
		);
	}

	return (await response.json()) as AvailableTimeClocksResponse;
}

export interface TimeClock {
	id: number;
	date: string;
	type: "clock_in" | "break_begin" | "break_end" | "clock_out";
	datetime: string;
	original_datetime: string;
	note: string;
}

export async function getTimeClocks(
	accessToken: string,
	employeeId: number,
	companyId: number,
	fromDate: string,
	toDate: string,
): Promise<TimeClock[]> {
	const response = await fetch(
		`https://api.freee.co.jp/hr/api/v1/employees/${employeeId}/time_clocks?company_id=${companyId}&from_date=${fromDate}&to_date=${toDate}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json",
			},
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new FreeeAPIError(
			"Failed to get time clocks from freee",
			response.status,
			response.statusText,
			errorText,
		);
	}

	return (await response.json()) as TimeClock[];
}

export interface ApprovalFlow {
	id: number;
	name: string;
	description: string;
}

export async function getApprovalFlows(
	accessToken: string,
	companyId: number,
): Promise<ApprovalFlow[]> {
	const response = await fetch(
		`https://api.freee.co.jp/hr/api/v1/approval_flows?company_id=${companyId}`,
		{
			method: "GET",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/json",
			},
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new FreeeAPIError(
			"Failed to get approval flows from freee",
			response.status,
			response.statusText,
			errorText,
		);
	}

	return (await response.json()) as ApprovalFlow[];
}

export interface PaidHolidayRequest {
	company_id: number;
	target_date: string;
	approval_flow_route_id: number;
	values: {
		type: "full" | "half" | "morning" | "afternoon" | "hourly";
		start_at?: string;
		end_at?: string;
	}[];
	comment?: string;
}

export async function postPaidHolidayRequest(
	accessToken: string,
	request: PaidHolidayRequest,
): Promise<void> {
	const response = await fetch(
		`https://api.freee.co.jp/hr/api/v1/approval_requests/paid_holidays`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body: JSON.stringify(request),
		},
	);

	if (!response.ok) {
		const errorText = await response.text();
		throw new FreeeAPIError(
			"Failed to post paid holiday request to freee",
			response.status,
			response.statusText,
			errorText,
		);
	}
}
