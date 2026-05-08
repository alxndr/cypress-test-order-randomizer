# TODOs

There may also be `TODO` strings in the app/test code or comments; ideally they should be migrated into this file to avoid being unintentionally ignored.

## feature / API ideas

It would be nice to be able to union / merge the CLI `--env` values with npm script aliases... e.g. the `cy-grep` issue


### how to work with CLI use of `--spec`?

Debugging unusual behavior when using this plugin with a `--spec` glob; the shuffled order wasn't being seen. Turns out it uses a different code path within Cypress; suggested fix is to change how you're calling Cypress to use `--config specPattern=your/glob/here*` ...

```
⏺ Looking at the admin run's `test:e2e:admin` script: it uses `--spec cypress/e2e/admin/*`. That's
   the issue.

  The plugin randomizes by modifying config.specPattern inside setupNodeEvents. When Cypress
  receives `--spec` on the command line, it resolves the spec list itself *after* `setupNodeEvents`
  finishes, bypassing `specPattern` entirely. So the plugin's file shuffle never takes effect —
  Cypress just runs the glob results in alphabetical order.

  The `randomizeBlocks` (within-spec it-block shuffling) IS still working for the admin run, by
  the way — you can see it in `track-page.cy.ts`: the first run shows *deleting a tease* before
  *adding a tease* (all pending), while the admin run shows *adding a tease* before
  *deleting a tease*.

  To fix the file order shuffle for the admin run, change `--spec` to `--config specPattern` in
  the almost-dead-dot-net package.json:

      "test:e2e:admin": "echo '...' && cypress run --config specPattern=\"cypress/e2e/admin/*\" --env grepTags=@admin"

  That way the plugin sees the pattern in `config.specPattern`, resolves and shuffles it, and
  Cypress uses the shuffled result.

  This is also worth a note in the plugin README — `--spec` is a known bypass.
```

It would be more user-friendly if we didn't require users to modify their current task definitions ...
