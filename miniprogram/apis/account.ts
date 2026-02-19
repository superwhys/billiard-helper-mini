/** 账户模块 API */

import { api } from './api'
import type { TokenResponse } from './api'

/** 用户信息 */
export interface User {
    id: number
    name: string
    avatar: string
    email: string
    created_at: string
    updated_at: string
}

/** 更新用户请求 */
export interface UpdateUserReq {
    name: string
}

/** 登录请求 */
export interface LoginReq {
    account: string
    code_id?: string
    password?: string
    verify_code?: string
}

/** 注册请求 */
export interface RegisterReq {
    account: string
    code: string
    code_id?: string
    name: string
    password: string
}

/** 发送注册验证码请求 */
export interface SendRegisterCodeReq {
    account: string
}

/** 发送注册验证码响应 */
export interface SendRegisterCodeResponse {
    code_id: string
}

/** 微信小程序登录请求 */
export interface WxLoginReq {
    code: string
}

export const login = (data: LoginReq) =>
    api.post<TokenResponse>('/account/login', data)

export const wxLogin = (data: WxLoginReq) =>
    api.post<TokenResponse>('/account/wx-login', data)

export const register = (data: RegisterReq) =>
    api.post<unknown>('/account/register', data)

export const sendRegisterCode = (data: SendRegisterCodeReq) =>
    api.post<SendRegisterCodeResponse>('/account/send-email-code', data)

export const getCurrentUser = () =>
    api.get<User>('/account/me')

export const updateUser = (data: UpdateUserReq) =>
    api.post<unknown>('/account/me/update', data)

export const logout = () =>
    api.post<unknown>('/account/logout')
