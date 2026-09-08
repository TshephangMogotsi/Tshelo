// Isolated DOM tests for the website; share one React runtime with the test renderer.
module.exports = {
  rootDir: '..',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: { url: 'https://tshelo.test/account/events/event-1?tab=files' },
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  testMatch: ['<rootDir>/security/web/**/*.web-test.js'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/(.*)$': '<rootDir>/admin/$1',
    '^react$': '<rootDir>/node_modules/react',
    '^react/(.*)$': '<rootDir>/node_modules/react/$1',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/node_modules/react-dom/$1',
    '^next/(.*)$': '<rootDir>/admin/node_modules/next/$1',
  },
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', {
      babelrc: false, configFile: false,
      presets: ['@babel/preset-typescript', ['@babel/preset-react', { runtime: 'automatic' }]],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }],
  },
}
