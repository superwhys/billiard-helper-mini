/** 对局模块 API */

import { api } from './api'
import type {
    Match, CreateMatchRequest, StartMatchRequest,
    JoinMatchRequest, LeaveMatchRequest, UpdateMatchRequest,
    DeleteMatchRequest, MatchDetailRequest, MatchListRequest,
    MatchActionRequest,
} from '../types/game'

export const createMatch = (data: CreateMatchRequest) =>
    api.post<Match>('/match/create', data)

export const startMatch = (data: StartMatchRequest) =>
    api.post<Match>('/match/start', data)

export const joinMatch = (data: JoinMatchRequest) =>
    api.post<Match>('/match/join', data)

export const leaveMatch = (data: LeaveMatchRequest) =>
    api.post<Match>('/match/leave', data)

export const updateMatch = (data: UpdateMatchRequest) =>
    api.post<Match>('/match/update', data)

export const deleteMatch = (data: DeleteMatchRequest) =>
    api.post<null>('/match/delete', data)

export const getMatchDetail = (data: MatchDetailRequest) =>
    api.get<Match>('/match/detail', { match_id: data.match_id })

export const getMatchList = (data?: MatchListRequest): Promise<Match[]> =>
    api.get<Match[]>('/match/list', {
        match_type: data?.match_type,
        limit: data?.limit,
        cursor: data?.cursor,
    }).then(list => list || [])

export const nextMatchRound = (data: MatchActionRequest) =>
    api.post<Match>('/match/round/next', data)

export const endMatch = (data: MatchActionRequest) =>
    api.post<null>('/match/end', data)
