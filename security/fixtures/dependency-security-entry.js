// Match React Navigation's namespace import from the CommonJS query-string
// package. This fixture is bundled and executed, not mocked by the test runner.
import * as queryString from 'query-string'

const parsed = queryString.parse(`note=Dumela+%E2%9C%93+%2B&code=EVT-A1B2C3D4&malformed=${'%80'.repeat(4096)}`)
globalThis.__tsheloDependencyResult = {
  note: parsed.note,
  code: parsed.code,
  malformed: parsed.malformed,
  serialized: queryString.stringify({ note: parsed.note }),
}
