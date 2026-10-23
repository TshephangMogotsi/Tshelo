# Tshelo maintained security replacement for braces

This is a local, unpublished fork of micromatch/braces 3.0.3 with the parser
nesting and AST traversal guards proposed in upstream PR #88. The fork has a
separate package identity because the original registry package remains vulnerable;
this is not an upstream release. MIT licensing and upstream attribution are retained.

Source: https://github.com/micromatch/braces/tree/a795ee83ecd011131b2d618fe754ac5a8e124dae
Patch review: https://github.com/micromatch/braces/pull/88
Advisory: GHSA-vfj7-8cjw-p6xm.

The guard limits parser/AST nesting to 128 and rejects AST cycles before recursive
compile, expand and stringify. Normal globs and shared acyclic nodes are retained.
The app owns maintenance until a compatible upstream patched release is published.
`npm audit` cannot track vulnerabilities for this unpublished package identity:
explicit regression, source-integrity and consumer-resolution tests cover this fix.
Do not interpret a clean registry audit as certification of vendored source.

Regenerate the committed archive after a reviewed source change with:
`npm pack ./vendor/braces --pack-destination ./vendor --ignore-scripts`
