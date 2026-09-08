// Server data services must run outside Expo's client-only Babel environment.
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  testMatch: ['<rootDir>/security/api/**/*.api-test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/(.*)$': '<rootDir>/admin/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['babel-jest', {
      babelrc: false,
      configFile: false,
      presets: ['@babel/preset-typescript'],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }],
  },
}
