/** 计分模块 API */

import { api } from './api'
import type { MatchScoreSyncEvent, MatchScoreUndoRequest } from '../types/score'

export const syncMatchScoreEvent = (data: MatchScoreSyncEvent) =>
    api.post<Record<string, unknown>>('/score/sync', data)

export const undoMatchScore = (data: MatchScoreUndoRequest) =>
    api.post<Record<string, unknown>>('/score/undo', data)
