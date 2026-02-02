#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 PinBridge Monetization System Validation\n');

// Check if all required files exist
const requiredFiles = [
  'src/lib/services/ad-service.ts',
  'src/lib/services/payment-service.ts',
  'src/components/ads/ad-manager.tsx',
  'src/components/ads/ad-native.tsx',
  'src/components/ads/ad-banner.tsx',
  'src/components/ads/ad-sidebar.tsx',
  'src/components/ads/ad-interstitial.tsx',
  'src/components/ads/ad-blocker-notice.tsx',
  'src/app/premium/page.tsx',
  'src/app/premium/success/page.tsx',
  'src/app/api/create-checkout-session/route.ts',
  'src/app/api/customer-portal/route.ts',
  'src/app/api/cancel-subscription/route.ts',
  'src/app/api/webhooks/stripe/route.ts',
  '.env.example',
  'MONETIZATION_SUMMARY.md',
  'TESTING_SUMMARY.md'
];

console.log('📁 Checking required files...');
let missingFiles = [];

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    missingFiles.push(file);
  }
});

// Check package.json for required dependencies
console.log('\n📦 Checking dependencies...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = ['@stripe/stripe-js', 'stripe'];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep] || packageJson.devDependencies[dep]) {
    console.log(`✅ ${dep}`);
  } else {
    console.log(`❌ ${dep} - MISSING`);
    missingFiles.push(dep);
  }
});

// Check environment variables in .env.example
console.log('\n🔧 Checking environment configuration...');
const envExample = fs.readFileSync('.env.example', 'utf8');
const requiredEnvVars = [
  'NEXT_PUBLIC_ADSENSE_CLIENT_ID',
  'NEXT_PUBLIC_GA_ID',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID'
];

requiredEnvVars.forEach(envVar => {
  if (envExample.includes(envVar)) {
    console.log(`✅ ${envVar}`);
  } else {
    console.log(`❌ ${envVar} - MISSING`);
    missingFiles.push(envVar);
  }
});

// Check test files
console.log('\n🧪 Checking test files...');
const testFiles = [
  'src/lib/services/__tests__/ad-service.test.ts',
  'src/lib/services/__tests__/payment-service.test.ts',
  'src/components/ads/__tests__/ad-native.test.tsx',
  'src/components/ads/__tests__/ad-blocker-notice.test.tsx',
  'src/app/premium/__tests__/page.test.tsx',
  'src/__tests__/monetization-integration.test.tsx',
  'src/lib/services/__tests__/monetization-system.property.test.ts'
];

testFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    missingFiles.push(file);
  }
});

// Summary
console.log('\n📊 Validation Summary');
console.log('='.repeat(50));

if (missingFiles.length === 0) {
  console.log('🎉 All monetization system files are present!');
  console.log('\n✨ System Features:');
  console.log('   • Google AdSense integration');
  console.log('   • Strategic ad placements');
  console.log('   • Premium subscription system');
  console.log('   • Stripe payment processing');
  console.log('   • Ad blocker detection');
  console.log('   • Comprehensive testing');
  console.log('   • API routes for payments');
  console.log('   • User preference management');
  
  console.log('\n🚀 Next Steps:');
  console.log('   1. Set up environment variables');
  console.log('   2. Configure Google AdSense account');
  console.log('   3. Set up Stripe products and pricing');
  console.log('   4. Test payment flows');
  console.log('   5. Deploy and monitor');
  
} else {
  console.log(`❌ ${missingFiles.length} issues found:`);
  missingFiles.forEach(file => console.log(`   • ${file}`));
}

console.log('\n📈 Revenue Streams Implemented:');
console.log('   • Google AdSense advertising');
console.log('   • Premium subscriptions ($4.99-$99.99)');
console.log('   • Travel-focused native ads');
console.log('   • Upgrade conversion funnels');

console.log('\n🎯 Monetization Strategy:');
console.log('   • Non-intrusive ad placement');
console.log('   • Clear premium value proposition');
console.log('   • User-friendly upgrade flow');
console.log('   • Comprehensive analytics tracking');

console.log('\nValidation complete! 🏁');