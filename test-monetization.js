#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🧪 Running Monetization System Tests...\n');

try {
  // Run specific test files
  const testFiles = [
    'src/lib/services/__tests__/ad-service.test.ts',
    'src/lib/services/__tests__/payment-service.test.ts',
    'src/components/ads/__tests__/ad-native.test.tsx',
    'src/components/ads/__tests__/ad-blocker-notice.test.tsx',
    'src/app/premium/__tests__/page.test.tsx',
    'src/__tests__/monetization-integration.test.tsx'
  ];

  for (const testFile of testFiles) {
    console.log(`\n📋 Testing: ${testFile}`);
    try {
      execSync(`npm test -- ${testFile} --verbose --silent`, { 
        stdio: 'inherit',
        timeout: 30000 
      });
      console.log(`✅ ${testFile} - PASSED`);
    } catch (error) {
      console.log(`❌ ${testFile} - FAILED`);
      console.log(`Error: ${error.message}`);
    }
  }

  console.log('\n🎯 Monetization Test Summary Complete');

} catch (error) {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
}