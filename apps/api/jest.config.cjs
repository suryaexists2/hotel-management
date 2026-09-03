const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.test' });
dotenv.config({ path: '.env' });
process.env.NODE_ENV = 'test';

const ROOT = __dirname;

module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  resolver: path.join(ROOT, 'jest.resolver.cjs'),
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
        diagnostics: {
          ignoreCodes: [151002],
        },
      },
    ],
  },
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'json', 'node'],
  testTimeout: 30000,
  verbose: true,
};
