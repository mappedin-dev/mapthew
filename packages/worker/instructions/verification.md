# Change Verification

> **When to Apply:** After making any code changes, before committing.

Verify your changes don't introduce regressions:

## Dependencies

If you modified dependencies (`package.json`, `requirements.txt`, etc.):

- Ensure install still works
- Ensure build still works

## Linting & Formatting

Run the linter/formatter if available and fix **all** issues before committing:

- Check `package.json` scripts for: `lint`, `fmt`, `format`, `prettier`, `eslint`
- Common commands: `pnpm lint`, `pnpm fmt`, `npm run prettier`, `npm run lint:fix`
- Do **not** commit code with linter errors or warnings

## Testing

Run relevant tests only — don't run the entire test suite if you only changed one module:

1. Check if there are any test scripts in `package.json`
2. Use test filtering if available (e.g., `pnpm test -- --filter=module-name`)
3. Look for test files related to the files you changed (e.g., `foo.test.ts` for `foo.ts`)
4. If tests fail due to your changes, fix them before proceeding
