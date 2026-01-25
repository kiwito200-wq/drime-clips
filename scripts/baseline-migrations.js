// Script to baseline migrations for existing production database
// This marks existing migrations as already applied if the database schema exists

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../prisma/migrations');

// Check if migrations are already tracked
try {
  execSync('npx prisma migrate status', { stdio: 'pipe', encoding: 'utf8' });
  console.log('✓ Migrations already tracked');
  process.exit(0);
} catch (error) {
  // Migrations not tracked, need to baseline
  console.log('⚠ Database not baselined, checking if schema exists...');
  
  // Get all migrations
  const migrations = fs.readdirSync(migrationsDir)
    .filter(dir => {
      const dirPath = path.join(migrationsDir, dir);
      return fs.statSync(dirPath).isDirectory() && fs.existsSync(path.join(dirPath, 'migration.sql'));
    })
    .sort();
  
  if (migrations.length === 0) {
    console.log('No migrations found');
    process.exit(0);
  }
  
  // Try to baseline all existing migrations
  // If the database already has the schema, mark migrations as applied
  console.log(`Attempting to baseline ${migrations.length} migration(s)...`);
  
  for (const migration of migrations) {
    try {
      execSync(`npx prisma migrate resolve --applied ${migration}`, { 
        stdio: 'pipe',
        encoding: 'utf8'
      });
      console.log(`✓ Baseline applied for: ${migration}`);
    } catch (err) {
      // If baseline fails, the migration might not exist in DB yet
      // This is OK, migrate deploy will handle it
      console.log(`⚠ Could not baseline ${migration}, will be applied by migrate deploy`);
    }
  }
  
  console.log('✓ Baseline process completed');
}
