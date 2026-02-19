/** 对局模块 API */

import { api } from './api'
import type {
    Match, CreateMatchRequest,
    DeleteMatchRequest, MatchListRequest,
} from '../types/game'

export const createMatch = (data: CreateMatchRequest) =>
    api.post<Match>('/match/create', data)

export const deleteMatch = (data: DeleteMatchRequest) =>
    api.post<null>('/match/delete', data)

export const getMatchList = (data?: MatchListRequest): Promise<Match[]> =>
    api.get<Match[]>('/match/list', {
        match_type: data?.match_type,
        limit: data?.limit,
        cursor: data?.cursor,
    }).then(list => list || [])
