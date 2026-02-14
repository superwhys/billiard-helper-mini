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

/** Token 响应 */
export interface TokenResponse {
    access_token: string
    refresh_token: string
}

/** 微信小程序登录请求 */
export interface WxLoginReq {
    code: string
}

