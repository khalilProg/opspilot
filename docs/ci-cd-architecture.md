# Continuous integration

The [CI workflow](../.github/workflows/ci.yml) runs on pull requests, pushes to `main`, and merge queue groups. It uses a read-only repository token and pins actions to specific commits.

| Job | Checks |
| --- | --- |
| Java tests | Run each Spring Boot service's Maven test suite with Java 21. Cache dependencies using its `pom.xml`. |
| Go tests | Run the notification worker's Go tests with the version in `go.mod`. Cache dependencies and build outputs using `go.sum`. |
| Frontend tests and build | Install from the lockfile with Node.js 24, run Vitest, type-check with TypeScript, and build the Vite bundle. Cache npm downloads using `package-lock.json`. |
| Compose configuration | Validate the base stack, test profile, and both development overrides using `.env.example`. |
| PostgreSQL and RabbitMQ integration | Build all four application images and start the stack with both development fixtures. Verify gateway routes, monitor CRUD, incident lifecycle, event persistence, broker recovery, duplicate handling, and webhook delivery. |
| CI Gate | Report success only when every upstream job succeeds, including the integration job. |

## Required check on `main`

Use the GitHub Actions check named `CI Gate` as the required status check for `main`. To configure it on a new repository or fork, get one successful CI run, then open **Settings → Rules → Rulesets** and add it to an active branch ruleset for `main`. Require a pull request before merging and select GitHub Actions as the check source. [GitHub troubleshooting for required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)

If a job fails, open the individual job for its logs. The integration job also prints recent Compose logs on failure and removes the test volumes during cleanup.
