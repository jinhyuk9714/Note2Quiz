# apps/api (FastAPI)

## 빠른 시작(예시)
```bash
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

## 체크(권장)
```bash
ruff check apps/api
ruff format --check apps/api
pyright apps/api
pytest
```
