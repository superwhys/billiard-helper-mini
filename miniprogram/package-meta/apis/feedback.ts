/** 反馈模块 API */
import { api } from '../../apis/api'

/** 反馈相关类型 */
export interface FeedbackSubmitRequest {
    content: string
}

export const submitFeedback = (data: FeedbackSubmitRequest) =>
    api.post<null>('/feedback/report', data)
