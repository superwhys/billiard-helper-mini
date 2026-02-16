/** 反馈模块 API */
import { api } from './api'
import type { FeedbackSubmitRequest } from '../types/feedback'

export const submitFeedback = (data: FeedbackSubmitRequest) =>
    api.post<null>('/feedback/report', data)
