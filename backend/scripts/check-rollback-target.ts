import 'dotenv/config'

import { pgPool } from '../src/db/client.js'
import { redis } from '../src/infra/redis/client.js'
import { ensureAdminRuntimePersistence } from '../src/modules/admin/runtime-state.js'

interface PublishRecordRow {
  id: string
  version: string
  created_at: string | Date
  source: string
}

const normalizeTarget = (value: string) => value.trim()

const readTarget = async (target: string): Promise<PublishRecordRow | null> => {
  if (target === 'latest') {
    const result = await pgPool.query<PublishRecordRow>(
      `
        select id, version, created_at, source
        from admin_publish_records
        where source = 'publish'
        order by created_at desc
        limit 1
      `,
    )
    return result.rows[0] ?? null
  }

  const result = await pgPool.query<PublishRecordRow>(
    `
      select id, version, created_at, source
      from admin_publish_records
      where source = 'publish'
        and (id = $1 or version = $1)
      order by created_at desc
      limit 1
    `,
    [target],
  )
  return result.rows[0] ?? null
}

const run = async () => {
  await ensureAdminRuntimePersistence()

  const rawTarget = process.argv[2] ?? ''
  const target = normalizeTarget(rawTarget || 'latest')

  const record = await readTarget(target)

  if (!record) {
    console.error(`[rollback-target] target not found: ${target}`)
    console.error('[rollback-target] ROLLBACK_TARGET=FAIL')
    process.exitCode = 1
    return
  }

  console.log(`[rollback-target] target=${target}`)
  console.log(`[rollback-target] id=${record.id}`)
  console.log(`[rollback-target] version=${record.version}`)
  console.log(`[rollback-target] createdAt=${new Date(record.created_at).toISOString()}`)
  console.log('[rollback-target] ROLLBACK_TARGET=PASS')
}

run()
  .catch((error) => {
    console.error('[rollback-target] failed')
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pgPool.end()

    if (redis.status !== 'end') {
      await redis.quit().catch(() => undefined)
    }
  })
