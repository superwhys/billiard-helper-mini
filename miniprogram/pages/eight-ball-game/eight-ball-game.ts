/** 中八计分页面 */
import type { Match } from '../../types/game'
import { getMatchDetail, endMatch } from '../../apis/game'
import { syncMatchScoreEvent, undoMatchScore } from '../../apis/scores'
import { gameStore } from '../../stores/game'

interface GamePlayer {
    id: number
    name: string
    totalScore: number
    avatarColor: string
    initial: string
}

const AVATAR_COLORS = ['avatar-teal', 'avatar-purple', 'avatar-orange', 'avatar-blue']

function buildPlayer(id: number, name: string, index: number): GamePlayer {
    var trimmed = name.trim()
    return {
        id,
        name,
        totalScore: 0,
        avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
        initial: trimmed ? trimmed.slice(0, 1) : '球',
    }
}

/** 解析服务端返回的中八分数快照 */
function parseEightBallScores(data: unknown): Record<string, number> | null {
    if (!data || typeof data !== 'object') return null
    var raw = data as Record<string, unknown>
    var result: Record<string, number> = {}

    Object.keys(raw).forEach(function (playerId) {
        var value = raw[playerId]
        if (typeof value === 'number' && isFinite(value)) {
            result[playerId] = value
            return
        }
        if (value && typeof value === 'object') {
            var payload = value as { score?: unknown }
            if (typeof payload.score === 'number' && isFinite(payload.score)) {
                result[playerId] = payload.score
            }
        }
    })

    return Object.keys(result).length ? result : null
}

Page({
    data: {
        statusBarHeight: 0,
        navBarHeight: 0,

        matchId: 0,
        roomName: '未命名对局',
        targetScore: 0,
        currentRound: 1,

        isPageLoading: true,
        isActionPending: false,
        isScoreSyncing: false,
        isUndoing: false,
        isGlobalBusy: true,

        players: [] as GamePlayer[],
        selectedPlayerId: 0,
        selectedPlayer: null as GamePlayer | null,
        leaderId: 0 as number | null,
        remainingScore: 0,
        canScoreSelected: true,
        matchFinished: false,
        winnerName: '',
    },

    onLoad(options: Record<string, string>) {
        var app = getApp<IAppOption>()
        this.setData({
            statusBarHeight: app.globalData.statusBarHeight,
            navBarHeight: app.globalData.navBarHeight,
        })

        var matchId = Number(options.matchId || 0)
        if (!matchId) {
            this.setData({ isPageLoading: false })
            this._updateGlobalBusy()
            return
        }
        this.setData({ matchId: matchId })
        this._loadMatchDetail(matchId)
    },

    /** 加载对局详情 */
    async _loadMatchDetail(matchId: number) {
        var startedAt = Date.now()
        try {
            var match = await getMatchDetail({ match_id: matchId })
            this._applyMatchDetail(match)
        } catch (err) {
            console.error('加载对局详情失败', err)
            wx.showToast({ title: '加载失败', icon: 'none' })
        } finally {
            var elapsed = Date.now() - startedAt
            var delay = elapsed < 500 ? 500 - elapsed : 0
            var self = this
            setTimeout(function () {
                self.setData({ isPageLoading: false })
                self._updateGlobalBusy()
            }, delay)
        }
    },

    /** 将对局详情应用到页面 */
    _applyMatchDetail(match: Match) {
        var roomName = (match.name || '').trim() || ('对局 #' + match.id)
        var targetScore = match.config ? match.config.target_score : 0
        var currentRound = match.match_round ?? 1

        var mappedPlayers = (match.players || []).map(function (p, index) {
            return buildPlayer(p.id ?? index + 1, p.nick_name ?? ('玩家 ' + (index + 1)), index)
        })
        var players = mappedPlayers.length
            ? mappedPlayers
            : [buildPlayer(1, '玩家 1', 0), buildPlayer(2, '玩家 2', 1)]

        var selectedPlayerId = players[0]?.id ?? 0

        this.setData({
            roomName: roomName,
            targetScore: targetScore,
            currentRound: currentRound,
            players: players,
            selectedPlayerId: selectedPlayerId,
        })

        var currentScores = parseEightBallScores(match.current_scores)
        if (currentScores) {
            this._applySyncScores(currentScores)
        }

        this._updateSelectedPlayer()
        this._updateLeader()
    },

    /** 将服务端分数快照应用到玩家数据 */
    _applySyncScores(data: Record<string, number>) {
        var players = this.data.players.slice()
        for (var i = 0; i < players.length; i++) {
            var payload = data[String(players[i].id)]
            if (typeof payload !== 'number') continue
            players[i] = {
                id: players[i].id,
                name: players[i].name,
                avatarColor: players[i].avatarColor,
                initial: players[i].initial,
                totalScore: payload,
            }
        }
        this.setData({ players: players })
        this._updateSelectedPlayer()
        this._updateLeader()
    },

    _updateSelectedPlayer() {
        var selected: GamePlayer | null = null
        var players = this.data.players
        for (var i = 0; i < players.length; i++) {
            if (players[i].id === this.data.selectedPlayerId) {
                selected = players[i]
                break
            }
        }
        if (!selected && players.length) {
            selected = players[0]
        }
        var targetScore = this.data.targetScore
        var winTarget = targetScore > 0 ? Math.floor(targetScore / 2) + 1 : 0
        var remainingScore = selected && winTarget > 0
            ? Math.max(winTarget - selected.totalScore, 0)
            : 0
        var winnerName = ''
        if (winTarget > 0) {
            for (var k = 0; k < players.length; k++) {
                if (players[k].totalScore >= winTarget) {
                    winnerName = players[k].name
                    break
                }
            }
        }
        var matchFinished = !!winnerName
        var canScoreSelected = !matchFinished && (!selected || winTarget <= 0
            ? true
            : selected.totalScore < winTarget)
        this.setData({
            selectedPlayer: selected,
            remainingScore: remainingScore,
            canScoreSelected: canScoreSelected,
            matchFinished: matchFinished,
            winnerName: winnerName,
        })
    },

    _updateLeader() {
        var players = this.data.players
        if (!players.length) {
            this.setData({ leaderId: null })
            return
        }
        var topScore = players[0].totalScore
        for (var i = 1; i < players.length; i++) {
            if (players[i].totalScore > topScore) {
                topScore = players[i].totalScore
            }
        }
        var leaders: GamePlayer[] = []
        for (var j = 0; j < players.length; j++) {
            if (players[j].totalScore === topScore) {
                leaders.push(players[j])
            }
        }
        this.setData({ leaderId: leaders.length === 1 ? leaders[0].id : null })
    },

    _updateGlobalBusy() {
        var busy = this.data.isActionPending || this.data.isScoreSyncing
            || this.data.isUndoing || this.data.isPageLoading
        this.setData({ isGlobalBusy: busy })
    },

    // ===== 用户交互 =====

    handleBack() {
        wx.switchTab({ url: '/pages/home/home' })
    },

    handleSelectPlayer(e: WechatMiniprogram.TouchEvent) {
        var playerId = Number(e.currentTarget.dataset.playerId)
        this.setData({ selectedPlayerId: playerId })
        this._updateSelectedPlayer()
    },

    /** 计分 */
    async handleScoreClick(e: WechatMiniprogram.TouchEvent) {
        if (this.data.isGlobalBusy || !this.data.matchId || !this.data.selectedPlayer
            || !this.data.canScoreSelected || this.data.matchFinished) return
        var delta = Number(e.currentTarget.dataset.delta || 1)
        if (!isFinite(delta) || delta === 0) return

        this.setData({ isScoreSyncing: true })
        this._updateGlobalBusy()

        try {
            var response = await syncMatchScoreEvent({
                operator_id: this.data.selectedPlayer.id,
                match_id: this.data.matchId,
                round: this.data.currentRound,
                score_actions: [{ player_ids: [this.data.selectedPlayer.id], score: delta }],
                context: { mode: '8ball', action: 'rack_win', delta: delta },
            })
            var payload = parseEightBallScores(response)
            if (payload) {
                this._applySyncScores(payload)
            } else {
                this._applyLocalDelta(this.data.selectedPlayer.id, delta)
            }
        } catch (err) {
            console.error('计分同步失败', err)
            wx.showToast({ title: (err as Error).message || '计分失败', icon: 'none' })
        } finally {
            this.setData({ isScoreSyncing: false })
            this._updateGlobalBusy()
        }
    },

    /** 撤回上一次计分 */
    async handleUndoScore() {
        if (!this.data.matchId || this.data.isGlobalBusy) return

        this.setData({ isUndoing: true })
        this._updateGlobalBusy()

        try {
            var response = await undoMatchScore({
                match_id: this.data.matchId,
                round: this.data.currentRound,
            })
            var payload = parseEightBallScores(response)
            if (payload) {
                this._applySyncScores(payload)
            }
        } catch (err) {
            console.error('撤回失败', err)
            wx.showToast({ title: (err as Error).message || '撤回失败', icon: 'none' })
        } finally {
            this.setData({ isUndoing: false })
            this._updateGlobalBusy()
        }
    },

    /** 结束对局 */
    async handleEndMatch() {
        if (!this.data.matchId || this.data.isGlobalBusy) return

        this.setData({ isActionPending: true })
        this._updateGlobalBusy()

        try {
            await endMatch({ match_id: this.data.matchId })
            gameStore.clearCurrentMatch()
            wx.switchTab({ url: '/pages/records/records' })
        } catch (err) {
            console.error('结束对局失败', err)
            wx.showToast({ title: (err as Error).message || '操作失败', icon: 'none' })
        } finally {
            this.setData({ isActionPending: false })
            this._updateGlobalBusy()
        }
    },

    /** 本地应用分数变化 */
    _applyLocalDelta(playerId: number, delta: number) {
        var players = this.data.players.slice()
        for (var i = 0; i < players.length; i++) {
            if (players[i].id === playerId) {
                players[i] = {
                    id: players[i].id,
                    name: players[i].name,
                    avatarColor: players[i].avatarColor,
                    initial: players[i].initial,
                    totalScore: players[i].totalScore + delta,
                }
                break
            }
        }
        this.setData({ players: players })
        this._updateSelectedPlayer()
        this._updateLeader()
    },

    /** 分享给朋友 */
    onShareAppMessage() {
        var title = this.data.roomName
            ? this.data.roomName + ' - 对局进行中'
            : '台球计分助手 - 一起来打球吧'
        return {
            title: title,
            path: '/pages/home/home',
        }
    },
})
