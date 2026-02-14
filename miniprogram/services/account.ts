/** 账户服务层，调用真实 API */
import type { User, UpdateUserReq } from '../types/user'
import * as accountApi from '../apis/account'

export const getCurrentUser = (): Promise<User> =>
    accountApi.getCurrentUser()

export const updateUser = (data: UpdateUserReq): Promise<unknown> =>
    accountApi.updateUser(data)

export const logout = (): Promise<unknown> =>
    accountApi.logout()
