import 'dotenv/config'

import { resolve } from 'node:path'

import { env } from '../src/config/env.js'
import { pgPool } from '../src/db/client.js'
import { redis } from '../src/infra/redis/client.js'
import { cleanupMediaOrphans, ensureAdminRuntimePersistence } from '../src/modules/admin/runtime-state.js'

const parseDryRun = (argv: string[]) => {
  if (argv.includes('--apply')) {
    return false
  }

  if (argv.includes('--dry-run')) {
    return true
  }

  return true
}

const run = async () => {
  const dryRun = parseDryRun(process.argv.slice(2))
  const localMediaStorageRoot = resolve(process.cwd(), env.MEDIA_LOCAL_UPLOAD_DIR)

  await ensureAdminRuntimePersistence()

  const report = await cleanupMediaOrphans({
    dryRun,
    localMediaStorageRoot,
  })

  const mode = dryRun ? 'dry-run' : 'apply'
  console.log(`[media-gc] mode=${mode}`)
  console.log(JSON.stringify(report, null, 2))
}

run()
  .catch((error) => {
    console.error('[media-gc] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pgPool.end()

    if (redis.status !== 'end') {
      await redis.quit().catch(() => undefined)
    }
  })
