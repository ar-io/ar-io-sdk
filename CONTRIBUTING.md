# Contributing Guidelines

NOTE: Contribution implies licensing under the terms of [LICENSE].

## Pull Request Checklist

- Confirm the PR is against the `alpha` branch.
- Ensure commit messages follow the [conventional commits] style.
- Ensure commit messages adequately explain the reasons for the changes.
- Follow [architecture guidelines] outlined in the README.
- Run [lint and format].
- Run the [tests].

## Writing Good Commit Messages

- All commits must match [conventional commits] formatting (e.g. `fix(web): update use of SubtleCrypto`)
- Keep the first line short but informative.
- Provide explanation of why the change is being made in the commit message body.
- Prefer copying relevant information into the commit body over linking to them.
- Consider whether your commit message includes enough detail for someone to be
  able to understand it in the future.

## Branching Workflow

- New branches should be created from `main`.
- When ready, PR's should be made against `alpha`. The team will review and merge when all issues/comments and all tests/CI must pass. Merging will create a new pre-release (e.g. `1.1.0-alpha.1`).
- The community & team will validate the pre-release and report any issues. If additional changes are required, a new PR should be made against `alpha` and the process repeated.
- Once the changes been validated in a pre-release package, a PR will then be created **by the team** from `alpha` to `main`. When merged, a new release package will be created (e.g. `1.1.0`) and available in [npm registry] and [Github releases].
- After release, `main` should me merged back into `alpha`, so future PR's will be based on the latest code.

[license]: ./LICENSE
[conventional commits]: https://www.conventionalcommits.org/en/v1.0.0/
[lint and format]: https://github.com/ar-io/ar-io-sdk/tree/main#linting--formatting
[tests]: https://github.com/ar-io/ar-io-sdk/tree/main#tests
[npm registry]: https://www.npmjs.com/package/@ar.io/sdk
[architecture guidelines]: https://github.com/ar-io/ar-io-sdk/tree/main#architecture
[Github releases]: https://github.com/ar-io/ar-io-sdk/releases
