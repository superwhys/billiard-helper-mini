/** 九球追分计分页面 */
import type { NineBallScoreKey, NineBallScores } from '../../types/nineball'
import { nineBallScoreKeys, nineBallScoreLabels, extractNineBallScores } from '../../types/nineball'
import type { Match } from '../../../types/game'
import { getMatchDetail, nextMatchRound, endMatch } from '../../apis/game'
import { syncMatchScoreEvent, undoMatchScore } from '../../apis/scores'
import { gameStore } from '../../../stores/game'

interface GamePlayerStats {
    big: number
    small: number
    golden: number
    win: number
    foul: number
}

interface GamePlayer {
    id: number
    name: string
    totalScore: number
    stats: GamePlayerStats
    avatarColor: string
    initial: string
}

interface StatConfig {
    key: NineBallScoreKey
    label: string
    delta: number
    tone: string
    deltaText: string
}

interface DeductCandidate extends GamePlayer {
    selected: boolean
}

const AVATAR_COLORS = ['avatar-teal', 'avatar-purple', 'avatar-orange', 'avatar-blue']

const STAT_KEY_TONES: Record<NineBallScoreKey, string> = {
    big: 'gold',
    small: 'amber',
    golden: 'orange',
    win: 'green',
    foul: 'red',
}

function buildStats(): GamePlayerStats {
    return { big: 0, small: 0, golden: 0, win: 0, foul: 0 }
}

function buildPlayer(id: number, name: string, index: number): GamePlayer {
    var trimmed = name.trim()
    return {
        id,
        name,
        totalScore: 0,
        stats: buildStats(),
        avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
        initial: trimmed ? trimmed.slice(0, 1) : '球',
    }
}

function buildStatConfigs(scoreConfig: NineBallScores): StatConfig[] {
    return nineBallScoreKeys.map(function (key) {
        var delta = scoreConfig[key]
        return {
            key: key,
            label: nineBallScoreLabels[key],
            delta: delta,
            tone: STAT_KEY_TONES[key],
            deltaText: delta > 0 ? '+' + delta : String(delta),
        }
    })
}

/** 解析服务端返回的九球分数快照 */
function parseNineBallScores(
    data: unknown,
): Record<string, { score: number; extra: Record<NineBallScoreKey, number> }> | null {
    if (!data || typeof data !== 'object') return null
    var raw = data as Record<string, unknown>
    var result: Record<string, { score: number; extra: Record<NineBallScoreKey, number> }> = {}

    Object.keys(raw).forEach(function (playerId) {
        var value = raw[playerId]
        if (!value || typeof value !== 'object') return
        var payload = value as { score?: unknown; extra?: unknown }
        if (typeof payload.score !== 'number' || !payload.extra || typeof payload.extra !== 'object') return

        var typeCountRaw = payload.extra as Record<string, unknown>
        var typeCount: Record<NineBallScoreKey, number> = { big: 0, small: 0, golden: 0, win: 0, foul: 0 }
        var isValid = nineBallScoreKeys.every(function (key) {
            return typeof typeCountRaw[key] === 'number'
        })
        if (!isValid) return

        nineBallScoreKeys.forEach(function (key) {
            typeCount[key] = typeCountRaw[key] as number
        })
        result[playerId] = { score: payload.score, extra: typeCount }
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

        statConfigs: [] as StatConfig[],

        // 扣分/加分弹窗
        isScoreModalOpen: false,
        hasDeductSelection: false,
        isDeductMode: false,
        isDoubleDeduct: false,
        modalTitle: '',
        pendingScoreDisplay: '',
        modalDeltaText: '',
        modalDeltaClass: '',
        deductCandidates: [] as DeductCandidate[],
    },

    _scoreConfig: {} as NineBallScores,
    _pendingScoreKey: null as NineBallScoreKey | null,
    _pendingScoreDelta: 0,
    _pendingScorePlayerId: null as number | null,
    _pendingDeductPlayerIds: [] as number[],

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
        this._scoreConfig = extractNineBallScores(match.config?.data)
        var currentRound = match.match_round ?? 1

        var mappedPlayers = (match.players || []).map(function (p, index) {
            return buildPlayer(p.id ?? index + 1, p.nick_name ?? ('玩家 ' + (index + 1)), index)
        })
        var players = mappedPlayers.length
            ? mappedPlayers
            : [buildPlayer(1, '玩家 1', 0), buildPlayer(2, '玩家 2', 1)]

        var selectedPlayerId = players[0]?.id ?? 0
        var statConfigs = buildStatConfigs(this._scoreConfig)

        this.setData({
            roomName: roomName,
            targetScore: targetScore,
            currentRound: currentRound,
            players: players,
            selectedPlayerId: selectedPlayerId,
            statConfigs: statConfigs,
        })

        var currentScores = parseNineBallScores(match.current_scores)
        if (currentScores) {
            this._applySyncScores(currentScores)
        }

        this._updateSelectedPlayer()
        this._updateLeader()
    },

    /** 将服务端分数快照应用到玩家数据 */
    _applySyncScores(data: Record<string, { score: number; extra: Record<NineBallScoreKey, number> }>) {
        var players = this.data.players.slice()
        for (var i = 0; i < players.length; i++) {
            var payload = data[String(players[i].id)]
            if (!payload) continue
            players[i] = {
                id: players[i].id,
                name: players[i].name,
                avatarColor: players[i].avatarColor,
                initial: players[i].initial,
                totalScore: payload.score,
                stats: {
                    big: payload.extra.big ?? 0,
                    small: payload.extra.small ?? 0,
                    golden: payload.extra.golden ?? 0,
                    win: payload.extra.win ?? 0,
                    foul: payload.extra.foul ?? 0,
                },
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
        this.setData({ selectedPlayer: selected })
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

    _resetPendingScore() {
        this._pendingScoreKey = null
        this._pendingScoreDelta = 0
        this._pendingScorePlayerId = null
        this._pendingDeductPlayerIds = []
        this.setData({ hasDeductSelection: false, isDoubleDeduct: false })
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

    handleScoreClick(e: WechatMiniprogram.TouchEvent) {
        if (this.data.isGlobalBusy || !this.data.matchId || !this.data.selectedPlayer) return

        var key = e.currentTarget.dataset.key as NineBallScoreKey
        var delta = Number(e.currentTarget.dataset.delta)

        this._pendingScoreKey = key
        this._pendingScoreDelta = delta
        this._pendingScorePlayerId = this.data.selectedPlayer.id
        this._pendingDeductPlayerIds = []

        var deductCandidates: DeductCandidate[] = []
        var scorerId = this._pendingScorePlayerId
        for (var i = 0; i < this.data.players.length; i++) {
            var p = this.data.players[i]
            if (p.id !== scorerId) {
                deductCandidates.push({
                    id: p.id,
                    name: p.name,
                    totalScore: p.totalScore,
                    stats: p.stats,
                    avatarColor: p.avatarColor,
                    initial: p.initial,
                    selected: false,
                })
            }
        }

        if (!deductCandidates.length) {
            this._syncPendingScore()
            return
        }

        var pendingScoreLabel = nineBallScoreLabels[key]
        var playerName = this.data.selectedPlayer.name
        var pendingScoreDisplay = '为 ' + playerName + ' 0 分（' + pendingScoreLabel + '）'

        var modalTitle = key === 'foul' ? '选择加分玩家' : '选择扣分玩家'
        var modalDeltaAbs = Math.abs(delta)
        var modalDeltaText = key === 'foul' ? ('+' + modalDeltaAbs) : ('-' + modalDeltaAbs)
        var modalDeltaClass = key === 'foul' ? 'modal-player-score-positive' : 'modal-player-score-negative'

        this.setData({
            isScoreModalOpen: true,
            hasDeductSelection: false,
            isDeductMode: key !== 'foul',
            isDoubleDeduct: false,
            deductCandidates: deductCandidates,
            modalTitle: modalTitle,
            pendingScoreDisplay: pendingScoreDisplay,
            modalDeltaText: modalDeltaText,
            modalDeltaClass: modalDeltaClass,
        })
    },

    handleDeductToggle(e: WechatMiniprogram.TouchEvent) {
        if (!this._pendingScorePlayerId || !this._pendingScoreKey) return

        var playerId = Number(e.currentTarget.dataset.playerId)
        var idx = this._pendingDeductPlayerIds.indexOf(playerId)
        if (idx >= 0) {
            this._pendingDeductPlayerIds.splice(idx, 1)
        } else {
            this._pendingDeductPlayerIds.push(playerId)
        }

        var candidates = this.data.deductCandidates.slice()
        for (var i = 0; i < candidates.length; i++) {
            if (candidates[i].id === playerId) {
                candidates[i] = Object.assign({}, candidates[i], { selected: !candidates[i].selected })
                break
            }
        }

        var selectedCount = this._pendingDeductPlayerIds.length
        var pending = this._buildPendingScoreDisplay(selectedCount)

        this.setData({
            deductCandidates: candidates,
            hasDeductSelection: selectedCount > 0,
            pendingScoreDisplay: pending.pendingScoreDisplay,
            modalDeltaText: pending.modalDeltaText,
            isDoubleDeduct: pending.isDoubleDeduct,
        })
    },

    handleToggleDoubleDeduct() {
        if (!this.data.isDeductMode) return
        var selectedCount = this._pendingDeductPlayerIds.length
        var pending = this._buildPendingScoreDisplay(selectedCount, !this.data.isDoubleDeduct)
        this.setData({
            isDoubleDeduct: pending.isDoubleDeduct,
            pendingScoreDisplay: pending.pendingScoreDisplay,
            modalDeltaText: pending.modalDeltaText,
        })
    },

    _buildPendingScoreDisplay(selectedCount: number, forceDouble?: boolean) {
        var key = this._pendingScoreKey! as NineBallScoreKey
        var delta = this._pendingScoreDelta
        var scorerName = ''
        for (var j = 0; j < this.data.players.length; j++) {
            if (this.data.players[j].id === this._pendingScorePlayerId) {
                scorerName = this.data.players[j].name
                break
            }
        }
        var shouldDouble = this.data.isDeductMode && (forceDouble ?? this.data.isDoubleDeduct)
        var multiplier = shouldDouble ? 2 : 1
        var scorerDelta = selectedCount > 0 ? delta * selectedCount * multiplier : 0
        var sign = scorerDelta > 0 ? ('+' + scorerDelta) : String(scorerDelta)
        var displayAbs = Math.abs(delta) * (this.data.isDeductMode ? multiplier : 1)
        var modalDeltaText = key === 'foul' ? ('+' + displayAbs) : ('-' + displayAbs)
        var pendingScoreDisplay = '为 ' + scorerName + ' ' + sign + ' 分（' + nineBallScoreLabels[key]
            + (selectedCount > 1 ? ' ×' + selectedCount : '')
            + (shouldDouble && selectedCount > 0 ? ' ×2' : '')
            + '）'

        return { pendingScoreDisplay: pendingScoreDisplay, modalDeltaText: modalDeltaText, isDoubleDeduct: shouldDouble }
    },

    async handleDeductConfirm() {
        if (!this._pendingDeductPlayerIds.length || this.data.isGlobalBusy) return
        await this._syncPendingScore()
    },

    handleScoreCancel() {
        this.setData({ isScoreModalOpen: false })
        this._resetPendingScore()
    },

    /** 同步待提交的计分事件 */
    async _syncPendingScore() {
        if (!this.data.matchId || !this._pendingScorePlayerId || !this._pendingScoreKey) return

        this.setData({ isScoreSyncing: true })
        this._updateGlobalBusy()

        try {
            var scoreActions = []
            var perPlayerMultiplier = this.data.isDeductMode && this.data.isDoubleDeduct ? 2 : 1
            if (this._pendingDeductPlayerIds.length) {
                scoreActions.push({
                    player_ids: this._pendingDeductPlayerIds.slice(),
                    score: -this._pendingScoreDelta * perPlayerMultiplier,
                })
            }
            var multiplier = (this._pendingDeductPlayerIds.length || 1) * perPlayerMultiplier
            scoreActions.push({
                player_ids: [this._pendingScorePlayerId],
                score: this._pendingScoreDelta * multiplier,
            })

            var response = await syncMatchScoreEvent({
                operator_id: this._pendingScorePlayerId,
                match_id: this.data.matchId,
                round: this.data.currentRound,
                score_actions: scoreActions,
                context: {
                    stat_key: this._pendingScoreKey,
                    scorer_player_id: this._pendingScorePlayerId,
                    deduct_player_ids: this._pendingDeductPlayerIds.slice(),
                },
            })

            var payload = parseNineBallScores(response)
            if (payload) {
                this._applySyncScores(payload)
            }
            this._resetPendingScore()
        } catch (err) {
            console.error('计分同步失败', err)
            wx.showToast({ title: (err as Error).message || '计分失败', icon: 'none' })
            this._resetPendingScore()
        } finally {
            this.setData({ isScoreSyncing: false, isScoreModalOpen: false })
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
            var payload = parseNineBallScores(response)
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

    /** 下一局 */
    async handleNextRound() {
        if (!this.data.matchId || this.data.isGlobalBusy) return

        this.setData({ isActionPending: true })
        this._updateGlobalBusy()

        try {
            var match = await nextMatchRound({ match_id: this.data.matchId })
            var currentRound = match.match_round ?? this.data.currentRound + 1
            this.setData({ currentRound: currentRound })
            var currentScores = parseNineBallScores(match.current_scores)
            if (currentScores) {
                this._applySyncScores(currentScores)
            }
        } catch (err) {
            console.error('下一局失败', err)
            wx.showToast({ title: (err as Error).message || '操作失败', icon: 'none' })
        } finally {
            this.setData({ isActionPending: false })
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
