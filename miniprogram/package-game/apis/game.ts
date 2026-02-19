/** 对局模块 API（分包） */

import { api } from '../../apis/api'
import type {
    Match, MatchActionRequest, MatchDetailRequest,
    StartMatchRequest, JoinMatchRequest, LeaveMatchRequest, UpdateMatchRequest,
} from '../../types/game'

export const getMatchDetail = (data: MatchDetailRequest) =>
    api.get<Match>('/match/detail', { match_id: data.match_id })

export const startMatch = (data: StartMatchRequest) =>
    api.post<Match>('/match/start', data)

export const joinMatch = (data: JoinMatchRequest) =>
    api.post<Match>('/match/join', data)

export const leaveMatch = (data: LeaveMatchRequest) =>
    api.post<Match>('/match/leave', data)

export const updateMatch = (data: UpdateMatchRequest) =>
    api.post<Match>('/match/update', data)

export const nextMatchRound = (data: MatchActionRequest) =>
    api.post<Match>('/match/round/next', data)

export const endMatch = (data: MatchActionRequest) =>
    api.post<null>('/match/end', data)
