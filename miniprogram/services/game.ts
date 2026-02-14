/** 对局服务层，调用真实 API */
import type {
    MatchListRequest, DeleteMatchRequest,
    CreateMatchRequest, StartMatchRequest, JoinMatchRequest,
    LeaveMatchRequest, UpdateMatchRequest,
} from '../types/game'
import * as gameApi from '../apis/game'

export const getMatchList = (params?: MatchListRequest) =>
    gameApi.getMatchList(params)

export const deleteMatch = (params: DeleteMatchRequest) =>
    gameApi.deleteMatch(params)

export const createMatch = (params: CreateMatchRequest) =>
    gameApi.createMatch(params)

export const startMatch = (params: StartMatchRequest) =>
    gameApi.startMatch(params)

export const joinMatch = (params: JoinMatchRequest) =>
    gameApi.joinMatch(params)

export const leaveMatch = (params: LeaveMatchRequest) =>
    gameApi.leaveMatch(params)

export const updateMatch = (params: UpdateMatchRequest) =>
    gameApi.updateMatch(params)
