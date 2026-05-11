* Reference: [Code Review Perspectives](https://kyosuke.dev/en/code/review.html)

## 📝 Summary

> [!NOTE]
> **Overall Evaluation: {{overallEvaluation}}**

{{summary}}

## 💡 List of Points

| Target (File, etc.) | Line | Reason | Priority | Overview |
| :--- | :--- | :--- | :--- | :--- |
{{feedbackTable}}

**[Response Policy]**
- `🔴 must` / `🟡 want`: Please address and fix.
- `💬 Q`: Please provide an answer.
- `🟢 nits`: Optional to address.

## 📊 Evaluation Score Details

| Perspective | Score (Out of 10) | Comments (Optional) |
| :--- | :--- | :--- |
| Correctness / Bug Risk | {{score_functionality}} / 10 | {{comment_functionality}} |
| Security | {{score_security}} / 10 | {{comment_security}} |
| Maintainability / Readability | {{score_maintainability}} / 10 | {{comment_maintainability}} |
| Performance | {{score_performance}} / 10 | {{comment_performance}} |
| Testing | {{score_testQuality}} / 10 | {{comment_testQuality}} |
| Design / Architecture | {{score_architecture}} / 10 | {{comment_architecture}} |
| PR Structure & Documentation | {{score_documentation}} / 10 | {{comment_documentation}} |
