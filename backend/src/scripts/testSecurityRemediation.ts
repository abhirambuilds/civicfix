import assert from 'node:assert/strict';
import { createAppConfig } from '../config/env.js';

let passed = 0;

function check(condition: boolean, message: string): void {
  assert.equal(condition, true, message);
  passed += 1;
  console.log(`  ✓ ${message}`);
}

console.log('\nCivicFix Security Remediation Configuration Tests');

assert.throws(
  () => createAppConfig({ NODE_ENV: 'production' }),
  /JWT_SECRET must be configured/,
  'production without JWT_SECRET fails configuration'
);
passed += 1;
console.log('  ✓ production without JWT_SECRET fails configuration');

assert.throws(
  () =>
    createAppConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'civicfix-dev-jwt-secret-do-not-use-in-production-change-in-env',
    }),
  /JWT_SECRET must be configured/,
  'production with the known development secret fails configuration'
);
passed += 1;
console.log('  ✓ production with the known development secret fails configuration');

const developmentConfig = createAppConfig({ NODE_ENV: 'development' });
check(
  developmentConfig.jwtSecret.length > 0,
  'development without JWT_SECRET retains offline/mock authentication support'
);

const productionConfig = createAppConfig({ NODE_ENV: 'production', JWT_SECRET: 'unique-production-secret' });
check(
  productionConfig.jwtSecret === 'unique-production-secret',
  'production accepts an explicitly configured JWT_SECRET'
);

console.log(`Security remediation configuration tests: ${passed}/${passed} PASS`);
