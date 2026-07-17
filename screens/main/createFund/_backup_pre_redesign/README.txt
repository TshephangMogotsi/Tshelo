Backup taken 2026-07-10, right before redesigning the Create hub UI
(CreateOptionChooser.tsx — the screen shown when tapping the "+" tab).

To revert:
  cp CreateOptionChooser.tsx.bak ../CreateOptionChooser.tsx
  cp constants.ts.bak            ../constants.ts
  cp CreateFundScreen.tsx.bak    ../../CreateFundScreen.tsx

Files are saved with a .bak extension (not .tsx/.ts) on purpose, so
TypeScript and Metro ignore them and they don't affect the build.
