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
		throw new Error(
			`Failed to get user info from freee: ${response.status} ${response.statusText} - ${errorText}`,
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
	// Freee uses "rest_start" and "rest_end" instead of break_begin/break_end? Actually let me double check.
	// Earlier search said: "rest_start" (休憩開始), "rest_end" (休憩終了). So let's map it.
	let freeeType = type as string;
	if (type === "break_begin") freeeType = "rest_start";
	if (type === "break_end") freeeType = "rest_end";

	const body: any = {
		company_id: companyId,
		type: freeeType,
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
		throw new Error(
			`Failed to post time clock to freee: ${response.status} ${response.statusText} - ${errorText}`,
		);
	}
}
