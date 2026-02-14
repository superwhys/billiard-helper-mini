/** 账户模块 API */

import { api } from './api'
import type {
    User, UpdateUserReq, LoginReq, RegisterReq,
    SendRegisterCodeReq, SendRegisterCodeResponse,
    TokenResponse, WxLoginReq,
} from '../types/user'

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
