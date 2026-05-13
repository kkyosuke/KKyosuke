* Reference: [Code Review Perspectives](https://kyosuke.dev/en/code/review.html)

## 📝 Summary

> [!NOTE]
> **Overall Evaluation: {{overallEvaluation}}**

{{summary}}

## 💡 List of Points
* Feedback with a specific file and line number will be commented directly on the code and is not displayed here.

| Target (File, etc.) | Line | Reason | Priority | Overview |
| :--- | :--- | :--- | :--- | :--- |
{{feedbackTable}}

**[Response Policy]**
- `🔴 must`: Issues that could lead to critical bugs, or negatively impact maintainability/availability. Please address and fix.
- `🟡 want`: Recommended improvements. Please fix them or provide a reason if you decide to skip.


## 📊 Evaluation Score Details

| Perspective | Score (Out of 5) | Comments (Optional) |
| :--- | :--- | :--- |
| Correctness / Bug Risk | {{score_functionality}} / 5 | {{comment_functionality}} |
| Security | {{score_security}} / 5 | {{comment_security}} |
| Maintainability / Readability | {{score_maintainability}} / 5 | {{comment_maintainability}} |
| Performance | {{score_performance}} / 5 | {{comment_performance}} |
| Testing | {{score_testQuality}} / 5 | {{comment_testQuality}} |
| Design / Architecture | {{score_architecture}} / 5 | {{comment_architecture}} |
| PR Structure & Documentation | {{score_documentation}} / 5 | {{comment_documentation}} |
