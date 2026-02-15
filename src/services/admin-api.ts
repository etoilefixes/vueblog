import { createAdminAccessApi } from './admin-api/access'
import { createAdminAuthApi } from './admin-api/auth'
import { createAdminContentApi } from './admin-api/content'
import { adminApiEndpoints } from './admin-api/core'
import { createAdminMediaApi } from './admin-api/media'
import { createAdminPublishApi } from './admin-api/publish'

export { adminApiEndpoints }

const authApi = createAdminAuthApi()
const contentApi = createAdminContentApi()
const publishApi = createAdminPublishApi()
const mediaApi = createAdminMediaApi()
const accessApi = createAdminAccessApi()

export const adminApi = {
  useBackendApi: true,
  endpoints: adminApiEndpoints,
  ...authApi,
  ...contentApi,
  ...publishApi,
  ...mediaApi,
  ...accessApi,
}
