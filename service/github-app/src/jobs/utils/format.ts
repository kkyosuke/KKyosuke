export function formatTemplate(
	template: string,
	values: Record<string, string>,
): string {
	let result = template;
	for (const [key, value] of Object.entries(values)) {
		result = result.replaceAll(`{{${key}}}`, value);
	}
	return result;
}

export function createFeedbackTable(
	feedbacks: Array<{
		path?: string;
		line: number;
		reason: string;
		severity: string;
		summary: string;
	}>,
): string {
	const generalFeedback = feedbacks.filter(
		(f) => !(f.path && f.path !== "-" && f.line > 0),
	);

	if (generalFeedback.length === 0) {
		return "| - | - | - | - | 特に指摘事項はありません |\n";
	}

	return generalFeedback
		.map(
			(f) =>
				`| ${f.path} | ${f.line > 0 ? f.line : "-"} | ${f.reason} | ${f.severity} | ${f.summary} |`,
		)
		.join("\n");
}
