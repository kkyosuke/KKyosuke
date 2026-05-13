# AIエージェント 手順書一覧

このディレクトリ（`docs/ja/agent/`）は、AIエージェント（GitHub Copilotなど）に対する手順書（プロンプト）を管理しています。

## 1. 手順書 (`instruction/`)

- [**`instruction/review.md`**](./instruction/review.md)
  - **用途**: Pull RequestのコードレビューをAIに自動実行させるためのプロンプトです。
  - **概要**: `docs/ja/code/pull-request.md` に記載されたPR作成方針を観点とし、適切に実装・ドキュメント作成が行われているかを診断・レビューします。
