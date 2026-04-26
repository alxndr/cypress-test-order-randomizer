# Project Plan

The goal is to create a TypeScript/NodeJS tool which implements a plugin for Cypress (https://cypress.io).

Our plugin will adjust the execution order of the test files that Cypress runs, as well as the `describe` and `it` blocks defined in them.

Let's aim to test-drive our code where possible.


## versions

- [ ] attempt upgrade to TypeScript v6
- [ ] set up e.g. `dependabot` (so that when TS v7 comes out we can see how it runs on CI without any modifications)


## deploying

- [ ] ...how do we deploy?


## CI

- [ ] expand the CI test matrix to cover other supported Cypress major versions (currently only tests against the version pinned in devDependencies)
