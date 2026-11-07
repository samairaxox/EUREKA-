$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

python -m uvicorn main:app --reload `
  --reload-exclude 'tests/**' `
  --reload-exclude 'outputs/**' `
  --reload-exclude 'work/**' `
  --reload-exclude 'study-frontend/**' `
  --reload-exclude 'node_modules/**' `
  --reload-exclude '.venv/**' `
  --reload-exclude '.pytest_cache/**' `
  --reload-exclude '__pycache__/**' `
  --reload-exclude '*.md' `
  --reload-exclude '*.diff' `
  --port 8000
