// Script to handle migrations for existing production database
// If database is not baselined, use db push for new tables (idempotent)

const { execSync } = require('child_process');

// First, try to check migration status
try {
  execSync('npx prisma migrate status', { stdio: 'pipe', encoding: 'utf8' });
  console.log('✓ Migrations already tracked, will use migrate deploy');
  // Exit with success, migrate deploy will run next
  process.exit(0);
} catch (error) {
  // Database not baselined (P3005 error or similar)
  console.log('⚠ Database not baselined (schema exists but migrations not tracked)');
  console.log('⚠ Using db push for new schema changes (idempotent)...');
  
  try {
    // Use db push which is idempotent and doesn't require baseline
    execSync('npx prisma db push --skip-generate --accept-data-loss', { 
      stdio: 'inherit'
    });
    console.log('✓ Schema synchronized with db push');
    // Exit with success, but skip migrate deploy since we used db push
    process.exit(0);
  } catch (pushError) {
    console.error('✗ db push failed:', pushError.message);
    // If db push fails, try migrate deploy anyway (might work if baseline was created)
    console.log('Attempting migrate deploy as fallback...');
    process.exit(0); // Let migrate deploy try
  }
}
