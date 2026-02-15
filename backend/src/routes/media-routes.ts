import { constants as fsConstants, createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

import type { FastifyInstance } from 'fastify'

interface RegisterLocalMediaRoutesOptions {
  localMediaStorageRoot: string
  localMediaMimeByExtension: Record<string, string>
}

export const registerLocalMediaRoutes = (
  server: FastifyInstance,
  { localMediaStorageRoot, localMediaMimeByExtension }: RegisterLocalMediaRoutesOptions,
) => {
  server.get('/api/media/local/:fileName', async (request, reply) => {
    const fileName = String((request.params as { fileName?: string }).fileName ?? '').trim()

    if (!/^[a-z0-9][a-z0-9._-]{5,120}$/i.test(fileName)) {
      return reply.status(404).send({
        code: 'MEDIA_NOT_FOUND',
        message: '媒体文件不存在',
        requestId: request.id,
      })
    }

    const absolutePath = resolve(localMediaStorageRoot, fileName)

    try {
      await access(absolutePath, fsConstants.R_OK)
    } catch {
      return reply.status(404).send({
        code: 'MEDIA_NOT_FOUND',
        message: '媒体文件不存在',
        requestId: request.id,
      })
    }

    const extension = extname(fileName).toLowerCase()
    const mimeType = localMediaMimeByExtension[extension] ?? 'application/octet-stream'

    reply.header('cache-control', 'public, max-age=31536000, immutable')
    reply.type(mimeType)
    return reply.send(createReadStream(absolutePath))
  })
}
