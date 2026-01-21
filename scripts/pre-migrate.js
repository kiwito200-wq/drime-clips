// Script to clean up failed migration state before applying migrations
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function cleanupFailedMigrations() {
  try {
    // Delete failed migration records
    const result = await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations"
      WHERE migration_name = '20260121_init'
        AND finished_at IS NULL
    `
    
    console.log(`✅ Cleaned up failed migration state`)
    return true
  } catch (error) {
    // If _prisma_migrations table doesn't exist yet, that's fine
    if (error.message.includes('does not exist') || error.code === 'P2021') {
      console.log('⚠️  Migration table does not exist yet, skipping cleanup')
      return true
    }
    console.error('⚠️  Failed to cleanup migration state:', error.message)
    // Don't fail the build if cleanup fails
    return true
  } finally {
    await prisma.$disconnect()
  }
}

cleanupFailedMigrations()
  .then(success => {
    if (success) {
      process.exit(0)
    } else {
      process.exit(1)
    }
  })
  .catch(error => {
    console.error('Error:', error)
    process.exit(1)
  })
