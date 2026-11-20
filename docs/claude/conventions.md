# Coding conventions

## TypeScript and code style

- `strict` TypeScript; no `any` (use `unknown` and narrow). No non-null assertions (`!`) outside
  tests.
- Formatting is Prettier's job (`printWidth` 100, double quotes, trailing commas). Do not
  hand-format; run `npm run format`.
- Import from `src/` with the `@/` alias (`@/lib/queue`), not long relative paths.
- Named exports everywhere except files Next.js requires to default-export (`page.tsx`,
  `layout.tsx`, route segment files).
- Server-only modules (db, auth secrets) import `"server-only"` so they cannot leak into client
  bundles.
- Validate every request body at the boundary before it reaches the domain.
- Domain code returns `Result<T>`; only infrastructure code throws, and route handlers translate
  errors to the HTTP mapping in PRD §6.2.
- Names: files `kebab-case.ts`, React components `PascalCase`, functions `camelCase`, error codes
  `SCREAMING_SNAKE` in the domain and `snake_case` in API responses.

## Files and folders

| What                | Where                                       |
| ------------------- | ------------------------------------------- |
| Domain rules        | `src/lib/queue/`                            |
| Unit test           | next to the file: `foo.test.ts`             |
| Integration test    | next to the file: `foo.integration.test.ts` |
| Migrations          | `db/migrations/NNN_description.sql`         |
| Feature plans       | `docs/plans/<issue>-<slug>.md`              |
| Independent reviews | `docs/reviews/`                             |
| Sprint records      | `docs/process/`                             |

## Git

- One branch per issue: `feature/<n>-slug`, `fix/<n>-slug`, `chore/<n>-slug`, `docs/<n>-slug`.
- Commit messages: `type(scope): short action (#issue)`. Types: `feat`, `fix`, `test`,
  `refactor`, `docs`, `chore`. TDD commits add a tag: `test(queue): [red] …`,
  `feat(queue): [green] …`.
- Commit bodies explain **why**; red commits include the key lines of the failing output.
- Stage files by name (`git add src/lib/queue/numbering.ts`). Never `git add -A`, `git add .`, or
  `git commit -a`.
- AI-assisted commits keep the `Co-Authored-By:` trailer.
