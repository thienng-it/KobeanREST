# Stack Reference: Python + FastAPI + ML/AI (`uv`)

> Distilled from `huggingface/skills`, `anthropics/skills` (`claude-api`), and modern Python practices (`trailofbits/skills/plugins/modern-python`).

## 1. Tooling & Environment (`MANDATORY`)
- **Package Manager:** Always use `uv` (`uv init`, `uv add`, `uv run pytest`, `uv run ruff check`). Never run global `pip install`.
- **Type Safety & Linting:** Enforce strict Pydantic v2 models (`model_config = ConfigDict(extra="forbid")`), type hints on every function signature, and `ruff` + `ty`/`mypy`.

## 2. FastAPI Service Design
- **Async Hygiene:** Never call blocking I/O (`requests`, synchronous DB drivers, CPU-heavy model inference) inside `async def` routes without offloading to a worker pool or background task.
- **Explicit Schemas:** Separate `Request`, `Response`, and internal `DB/Domain` Pydantic models. Never return raw ORM objects or untyped dicts.
- **Dependency Injection:** Use FastAPI `Depends()` for auth, DB sessions, and model clients so tests can cleanly override them via `app.dependency_overrides`.

## 3. AI / LLM & ML Engineering Rules
- **Structured Outputs:** When calling LLMs, enforce structured JSON schemas / tool schemas and validate the parsed output with Pydantic.
- **Evaluation First:** Every prompt, RAG pipeline, or fine-tuned model change requires a reproducible offline eval dataset (`evals/`) scoring accuracy, latency, and token cost before and after the change.
- **Reproducibility:** Pin dataset revisions, random seeds, and model checkpoints; log metrics cleanly.

