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
