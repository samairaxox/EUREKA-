Backend CORS fix for checklist delete (and test isolation).

Files changed (copy over the originals in your project):
  main.py                    -> project root. One line: DELETE added to CORSMiddleware allow_methods.
  tests/conftest.py          -> your conftest.py. One line: AUTO_MIGRATE=false for tests.
                                (In the archive this file sits at the root as conftest.py.)
  tests/test_workspace_api.py-> your test_workspace_api.py. Two regression tests appended.

CHANGES.diff shows the exact changes against the uploaded source.
Run: python -m pytest -q   (expected: 47 passed in the rebuilt tree).
