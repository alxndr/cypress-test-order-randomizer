# TODOs

There may also be `TODO` strings in the app/test code or comments; ideally they should be migrated into this file to avoid being ignored.


## versions

- [x] upgrade to TypeScript v6


## deploying

- [ ] review https://glebbahmutov.com/blog/how-i-publish-to-npm/ and see how that might inform what we're doing
- [ ] set up a GitHub Actions workflow with `workflow_dispatch` (manual trigger) that builds, runs tests, then publishes to npm using an `NPM_TOKEN` repository secret — enforces the full build+test+publish sequence without relying on the publisher's memory, while keeping the publish decision human-initiated rather than fully automatic


## CI

- [ ] set up e.g. `dependabot` (so that when TS v7 comes out we can see how it runs on CI without any modifications)
- [ ] support multiple major versions of Cypress?
