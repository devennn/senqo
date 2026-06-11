# Branch naming

```
<type>/<short-description>
```

**Types:** `feat` · `fix` · `test` · `task` · `chore` · `docs` · `refactor`

Use lowercase kebab-case after the slash. Keep it short and specific.

| Type | When |
|------|------|
| `feat` | New feature or user-visible behavior |
| `fix` | Bug fix |
| `test` | Tests only |
| `task` | Planned work (multi-step, not a single bug/feature) |
| `chore` | CI, deps, config |
| `docs` | Documentation only |
| `refactor` | Code change, same behavior |

**Examples**

```
feat/custom-tools-ui
fix/contact-pagination
test/custom-tools-e2e
task/pr-template
chore/ci-branch-check
```

CI rejects PRs whose branch name does not match (bots excepted).
