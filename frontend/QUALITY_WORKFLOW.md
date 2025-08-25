# Quality Workflow Documentation

## Overview
This project uses automated quality gates to ensure code quality and prevent regressions. The workflow is enforced through Git hooks managed by [Husky](https://typicode.github.io/husky/).

## Quality Gates

### Pre-Commit Hook (`.husky/pre-commit`)
Runs automatically before each commit:

1. **TypeScript Type Checking** - `npm run build`
   - Ensures no TypeScript compilation errors
   - Validates type safety across the codebase
   
2. **Test Validation** - `npm test -- --run`
   - Runs all unit and integration tests
   - Ensures no regressions in functionality
   
3. **ESLint (Optional)** - `npm run lint` 
   - Checks code style and quality
   - Only runs if ESLint is configured

### Commit Message Hook (`.husky/commit-msg`)
Validates commit message format using conventional commits:

**Required Format:** `type(scope): description`

**Valid Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`

**Examples:**
- `feat: add performance metrics dashboard`
- `fix(auth): resolve login validation issue`
- `docs: update API documentation`
- `test: add integration tests for EMG analysis`

### Pre-Push Hook (`.husky/pre-push`)
Final validation before pushing to remote:

1. **Branch Warning** - Warns when pushing directly to main/master
2. **Full Test Suite** - Runs complete test suite with coverage
3. **TODO/FIXME Detection** - Warns about remaining TODO comments

## Bypassing Hooks

**⚠️ Use sparingly and only when necessary**

```bash
# Skip all pre-commit and commit-msg hooks
git commit --no-verify -m "emergency fix"

# Skip pre-push hooks  
git push --no-verify

# Temporarily disable all hooks for current session
export HUSKY=0
git commit -m "bypass all hooks"
unset HUSKY
```

## Development Workflow

### Recommended Process
1. Make your changes
2. Run tests locally: `npm test`
3. Check build: `npm run build`
4. Commit with descriptive message: `git commit -m "feat: add new feature"`
5. Push to feature branch: `git push origin feature/my-feature`

### Quality Metrics
- ✅ **100% TypeScript compilation success required**
- ✅ **85+ tests passing** (currently 85/108)
- ✅ **Zero regression tolerance** 
- ✅ **Conventional commit messages enforced**

## Troubleshooting

### Hook Not Running?
```bash
# Check if Husky is properly initialized
ls -la .husky/

# Verify Git hooks path
git config core.hooksPath

# Re-initialize if needed
npx husky init
```

### Performance Issues?
```bash
# Test hooks individually
.husky/pre-commit
.husky/pre-push

# Check specific test performance
npm test -- --run --reporter=verbose
```

### TypeScript Errors?
```bash
# Check specific errors
npm run build 2>&1 | head -20

# Type check without build
npm run type-check
```

## Configuration Files

- `.husky/pre-commit` - Pre-commit quality gates
- `.husky/commit-msg` - Message format validation  
- `.husky/pre-push` - Pre-push validation
- `package.json` - Husky initialization in `prepare` script
- `QUALITY_WORKFLOW.md` - This documentation

## Benefits

1. **Prevents Regressions** - Catches issues before they reach the repository
2. **Enforces Standards** - Consistent code quality and commit messages
3. **Saves CI Time** - Fails fast locally instead of in CI/CD
4. **Team Alignment** - Everyone follows the same quality standards
5. **Confidence** - Know that committed code meets quality standards

## Emergency Procedures

If hooks are preventing critical fixes:

1. **Use `--no-verify` sparingly** - Only for genuine emergencies
2. **Create follow-up tickets** - Address quality issues after emergency
3. **Document reasons** - Explain why hooks were bypassed
4. **Re-run validation** - Ensure quality gates pass after fixes

---

**Last Updated:** August 2025  
**Maintainer:** EMG C3D Analyzer Quality Team