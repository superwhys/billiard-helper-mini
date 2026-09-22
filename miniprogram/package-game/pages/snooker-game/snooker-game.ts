/** 斯诺克计分；比分、球序和撤销均以服务端快照为准。 */
import type { Match, MatchGameScore } from '../../../types/game'
import { snookerBalls, type SnookerState } from '../../../types/snooker'
import { readSnookerState, isSnookerBallAllowed, snookerTargetLabel } from '../../../utils/snooker'
import { snookerFrameWins } from '../../../utils/match'
import { gameStore } from '../../../stores/game'
import { getMatchDetail, nextMatchRound } from '../../apis/game'
import { syncMatchScoreEvent, undoMatchScore } from '../../apis/scores'

interface GamePlayer {
    id: number
    name: string
    score: number
    frames: number
}

type Dialog = '' | 'foul' | 'settle' | 'concede'

Page({
    data: {
        matchId: 0,
        roomName: '',
        currentRound: 1,
        targetScore: 1,
        winTarget: 1,
        loading: true,
        busy: false,
        online: true,
        ready: false,
        needsRefresh: false,
        error: '',
        notice: '',
        players: [] as GamePlayer[],
        selectedId: 0,
        selectedName: '',
        opponentName: '',
        leaderName: '',
        leadPoints: 0,
        table: null as SnookerState | null,
        targetLabel: '',
        balls: snookerBalls.map(function (ball) { return { ...ball, allowed: false } }),
        canUndo: false,
        completedFrames: [] as Array<{ id: number; round: number; score: string; winner: string }>,
        dialog: '' as Dialog,
        penalty: 4,
        penaltyOptions: [4, 5, 6, 7],
        redsRemoved: '0',
        replayFoul: false,
    },

    _match: null as Match | null,
    _unloaded: false,
    _networkListener: null as ((res: WechatMiniprogram.OnNetworkStatusChangeCallbackResult) => void) | null,

    onLoad(options: Record<string, string>) {
        this.setData({ matchId: Number(options.matchId || 0) })
        this._networkListener = (res) => {
            if (this._unloaded) return
            this.setData({ online: res.isConnected })
            if (res.isConnected) this.loadMatch()
        }
        wx.onNetworkStatusChange(this._networkListener)
        wx.getNetworkType({ success: (res) => {
            if (!this._unloaded) this.setData({ online: res.networkType !== 'none' })
        } })
    },

    onShow() {
        this.loadMatch()
    },

    onUnload() {
        this._unloaded = true
        if (this._networkListener) wx.offNetworkStatusChange(this._networkListener)
    },

    async loadMatch() {
        if (this._unloaded || this.data.busy) return
        this.setData({ loading: true, busy: true, error: '', dialog: '' })
        try {
            if (!Number.isInteger(this.data.matchId) || this.data.matchId <= 0)
                throw new Error('请从首页或对局记录进入比赛')
            var match = await getMatchDetail({ match_id: this.data.matchId })
            if (this._unloaded) return
            if (match.status !== 2 || match.match_type !== 'snooker') {
                this.setData({ ready: false })
                this.redirectMatch(match)
                return
            }
            this.applyMatch(match)
            this.setData({ needsRefresh: false })
        } catch (err) {
            if (!this._unloaded)
                this.setData({ error: (err as Error).message || '加载失败，请重试', needsRefresh: true })
        } finally {
            if (!this._unloaded) this.setData({ loading: false, busy: false })
        }
    },

    redirectMatch(match: Match) {
        gameStore.setCurrentMatch(match)
        var route = '/package-record/pages/record-detail/record-detail'
        if (match.status === 1) route = '/package-game/pages/create-room/create-room'
        else if (match.status === 2) {
            route = match.match_type === '8ball'
                ? '/package-game/pages/eight-ball-game/eight-ball-game'
                : '/package-game/pages/nine-ball-game/nine-ball-game'
        }
        wx.redirectTo({ url: route + '?matchId=' + match.id })
    },

    applyMatch(match: Match) {
        var scores = match.current_scores
            || match.match_games?.find(function (game) { return game.game_num === match.match_round })?.scores
        const table = readSnookerState(scores)
        if (match.players.length !== 2 || match.players.some(function (player) {
            return !player.id || !Number.isFinite(scores?.[player.id]?.score)
        })) throw new Error('分数返回异常，请刷新后再操作')
        if (table && table.active_player_id && !match.players.some(function (player) {
            return player.id === table.active_player_id
        })) throw new Error('击球球员异常，请刷新后再操作')
        var selectedId = table
            ? table.active_player_id || match.players[0].id!
            : this.data.selectedId || match.players[0].id!
        if (!match.players.some(function (player) { return player.id === selectedId }))
            selectedId = match.players[0].id!
        var players = match.players.map(function (player) {
            return {
                id: player.id!, name: player.nick_name || '球员',
                score: scores![player.id!].score,
                frames: snookerFrameWins(match, player.id!),
            }
        })
        var selected = players.find(function (player) { return player.id === selectedId })!
        var opponent = players.find(function (player) { return player.id !== selectedId })!
        var leader = players[0].score === players[1].score ? null
            : players[0].score > players[1].score ? players[0] : players[1]
        var completedFrames = (match.match_games || []).filter(function (game) { return game.end_at }).map(function (game) {
            return {
                id: game.id,
                round: game.game_num,
                score: players.map(function (player) { return game.scores?.[player.id]?.score ?? 0 }).join(' : '),
                winner: players.find(function (player) { return player.id === game.winner_id })?.name || '球员',
            }
        })
        this._match = { ...match, current_scores: scores }
        gameStore.setCurrentMatch(this._match)
        this.setData({
            ready: true,
            roomName: match.name || ('对局 #' + match.id),
            currentRound: match.match_round,
            targetScore: match.config.target_score,
            winTarget: Math.floor(match.config.target_score / 2) + 1,
            players: players,
            selectedId: selectedId,
            selectedName: selected.name,
            opponentName: opponent.name,
            leaderName: leader?.name || '',
            leadPoints: Math.abs(players[0].score - players[1].score),
            table: table || null,
            targetLabel: snookerTargetLabel(table),
            balls: snookerBalls.map(function (ball) { return { ...ball, allowed: isSnookerBallAllowed(ball.key, table) } }),
            canUndo: table?.can_undo ?? players.some(function (player) { return player.score > 0 }),
            completedFrames: completedFrames,
        })
    },

    applyScores(scores: Record<string, unknown>) {
        if (!scores || typeof scores !== 'object' || !this._match)
            throw new Error('分数返回异常，请刷新后再操作')
        var match = this._match
        this.applyMatch({
            ...match,
            current_scores: scores as MatchGameScore,
            match_games: match.match_games?.map(function (game) {
                return game.game_num === match.match_round ? { ...game, scores: scores as MatchGameScore } : game
            }),
        })
    },

    canAct(): boolean {
        return !this._unloaded && this.data.ready && !this.data.busy && this.data.online && !this.data.needsRefresh
    },

    async score(key: string, points: number) {
        if (!this.canAct() || !this._match || this.data.table?.next_ball === 'done') return
        if (key !== 'foul' && !isSnookerBallAllowed(key, this.data.table || undefined)) return
        var selectedId = this.data.selectedId
        var opponent = this.data.players.find(function (player) { return player.id !== selectedId })!
        var recipientId = key === 'foul' ? opponent.id : selectedId
        var redsRemoved = Number(this.data.redsRemoved)
        if (key === 'foul' && this.data.table && (!Number.isInteger(redsRemoved) || redsRemoved < 0
            || redsRemoved > this.data.table.reds_remaining)) {
            this.setData({ error: '离台红球数必须为 0 到剩余红球数之间的整数' })
            return
        }
        var selectedName = this.data.selectedName
        this.setData({ busy: true, error: '', notice: '' })
        try {
            var scores = await syncMatchScoreEvent({
                operator_id: this._match.owner_id,
                match_id: this.data.matchId,
                round: this.data.currentRound,
                score_actions: [{ player_ids: [recipientId], score: points }],
                context: {
                    stat_key: key,
                    scorer_player_id: selectedId,
                    ...(key === 'foul' && this.data.table ? {
                        reds_removed: redsRemoved,
                        next_player_id: this.data.replayFoul ? selectedId : opponent.id,
                    } : {}),
                },
            })
            if (this._unloaded) return
            this.applyScores(scores)
            this.setData({ dialog: '', notice: key === 'foul'
                ? selectedName + ' 犯规，' + opponent.name + ' +' + points + ' 分'
                : selectedName + ' ' + snookerBalls.find(function (ball) { return ball.key === key })?.name + ' +' + points + ' 分' })
        } catch (err) {
            this.actionFailed(err)
        } finally {
            if (!this._unloaded) this.setData({ busy: false })
        }
    },

    handleBall(e: WechatMiniprogram.TouchEvent) {
        var ball = snookerBalls.find(function (item) { return item.key === e.currentTarget.dataset.key })
        if (ball) return this.score(ball.key, ball.points)
        return Promise.resolve()
    },

    async handleSwitch(e: WechatMiniprogram.TouchEvent) {
        if (!this.canAct() || !this._match || this.data.table?.next_ball === 'done') return
        var selectedId = this.data.selectedId
        var id = Number(e.currentTarget.dataset.id)
            || this.data.players.find(function (player) { return player.id !== selectedId })!.id
        if (id === selectedId || !this.data.players.some(function (player) { return player.id === id })) return
        if (!this.data.table) {
            this.setData({ selectedId: id })
            this.applyMatch(this._match)
            return
        }
        this.setData({ busy: true, error: '', notice: '' })
        try {
            var scores = await syncMatchScoreEvent({
                operator_id: this._match.owner_id,
                match_id: this.data.matchId,
                round: this.data.currentRound,
                score_actions: [],
                context: { stat_key: 'turn_end', scorer_player_id: selectedId, next_player_id: id },
            })
            if (this._unloaded) return
            this.applyScores(scores)
            this.setData({ notice: '已结束单杆，由 ' + this.data.selectedName + ' 击球' })
        } catch (err) {
            this.actionFailed(err)
        } finally {
            if (!this._unloaded) this.setData({ busy: false })
        }
    },

    async handleUndo() {
        if (!this.canAct() || !this.data.canUndo) return
        this.setData({ busy: true, error: '', notice: '' })
        try {
            var scores = await undoMatchScore({ match_id: this.data.matchId, round: this.data.currentRound })
            if (this._unloaded) return
            this.applyScores(scores)
            this.setData({ notice: '已撤销本局上一次操作' })
        } catch (err) {
            this.actionFailed(err)
        } finally {
            if (!this._unloaded) this.setData({ busy: false })
        }
    },

    handleOpenDialog(e: WechatMiniprogram.TouchEvent) {
        if (!this.canAct()) return
        var dialog = e.currentTarget.dataset.dialog as Dialog
        if (dialog === 'settle' && !this.data.leaderName) return
        if (dialog === 'foul' && this.data.table?.next_ball === 'done') return
        var next = this.data.table?.next_ball
        var minimum = next === 'respotted_black' ? 7
            : Math.max(4, snookerBalls.find(function (ball) { return ball.key === next })?.points || 4)
        this.setData({ dialog: dialog, error: '', penalty: minimum,
            penaltyOptions: [4, 5, 6, 7].filter(function (value) { return value >= minimum }),
            redsRemoved: '0', replayFoul: false })
    },

    handleCloseDialog() {
        if (!this.data.busy) this.setData({ dialog: '' })
    },

    handlePenalty(e: WechatMiniprogram.TouchEvent) {
        var penalty = Number(e.currentTarget.dataset.penalty)
        if (!this.data.busy && this.data.penaltyOptions.includes(penalty)) this.setData({ penalty: penalty })
    },

    handleRedsRemoved(e: WechatMiniprogram.Input) {
        if (!this.data.busy) this.setData({ redsRemoved: e.detail.value })
    },

    handleReplayFoul(e: WechatMiniprogram.SwitchChange) {
        if (!this.data.busy) this.setData({ replayFoul: e.detail.value })
    },

    async handleConfirm() {
        if (!this.canAct() || !this.data.dialog) return
        if (this.data.dialog === 'foul') {
            await this.score('foul', this.data.penalty)
            return
        }
        if (this.data.dialog === 'settle' && !this.data.leaderName) return
        this.setData({ busy: true, error: '', notice: '' })
        try {
            var match = await nextMatchRound({
                match_id: this.data.matchId,
                round: this.data.currentRound,
                ...(this.data.dialog === 'concede' ? { conceding_player_id: this.data.selectedId } : {}),
            })
            if (this._unloaded) return
            if (match.status === 3) {
                this.setData({ ready: false, dialog: '' })
                this.redirectMatch(match)
            } else {
                this.applyMatch(match)
                this.setData({ dialog: '', notice: '上一局已结算，开始第 ' + match.match_round + ' 局' })
            }
        } catch (err) {
            this.actionFailed(err)
        } finally {
            if (!this._unloaded) this.setData({ busy: false })
        }
    },

    actionFailed(err: unknown) {
        if (this._unloaded) return
        // 请求失败可能已在服务端落库，刷新确认后才允许继续，避免重复记分。
        this.setData({ error: (err as Error).message || '保存失败，请刷新确认比分', needsRefresh: true })
    },

    stopTap() {},

    onShareAppMessage() {
        return { title: '台球计分助手 - 一起来打球吧', path: '/pages/home/home' }
    },
})
