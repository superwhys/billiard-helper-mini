/** 创建/编辑对局页面 */
import { GAME_MODES, NineBallGame } from '../../../types/game'
import type { GameModeId, Match } from '../../../types/game'
import { nineBallScoreKeys, nineBallScoreLabels, extractNineBallScores } from '../../types/nineball'
import { updateMatch, joinMatch, leaveMatch, startMatch } from '../../apis/game'
import { deleteMatch } from '../../../apis/game'
import { gameStore } from '../../../stores/game'
import { maximumSnookerBreak } from '../../../types/snooker'

var matchTypeToModeMap: Record<string, GameModeId> = {
    '9ball': 'nine-ball',
    '8ball': 'eight-ball',
    'snooker': 'snooker',
}

var matchTypeToRouteMap: Record<string, string> = {
    '9ball': '/package-game/pages/nine-ball-game/nine-ball-game',
    '8ball': '/package-game/pages/eight-ball-game/eight-ball-game',
    'snooker': '/package-game/pages/snooker-game/snooker-game',
}

var randomNameAdjectives = ['旋风', '雷霆', '追风', '破浪', '夜影', '疾光', '星河', '流火', '晨曦', '暮影']
var randomNameNouns = ['球手', '球侠', '猎手', '行者', '之刃', '之星', '战将', '逐影', '破阵', '飞影']

function buildRandomPlayerName(existingNames: string[], fallbackId: number): string {
    var existingSet: Record<string, boolean> = {}
    for (var i = 0; i < existingNames.length; i++) {
        var n = existingNames[i].trim()
        if (n) { existingSet[n] = true }
    }
    for (var attempt = 0; attempt < 6; attempt++) {
        var adj = randomNameAdjectives[Math.floor(Math.random() * randomNameAdjectives.length)]
        var noun = randomNameNouns[Math.floor(Math.random() * randomNameNouns.length)]
        var candidate = adj + noun
        if (!existingSet[candidate]) { return candidate }
    }
    return '玩家 ' + fallbackId
}

function calcTargetWin(totalRounds: number): number {
    return Math.floor((totalRounds + 1) / 2)
}

interface RoomPlayer {
    id: number
    nick_name: string
    player_code: string
}

Page({
    data: {
        matchId: 0,
        matchIdText: '--',
        modeBadge: '-',
        modeTitle: '桌球对局',
        modeDesc: '标准计分',
        modeMaxPlayers: 4,
        modeMeta: '最多 4 人',
        isNineBall: true,
        isSnooker: false,
        redCount: '15',
        maximumBreak: '147',
        redOptions: [6, 10, 15],
        formError: '',
        isStarting: false,
        isPlayerPending: false,
        roomName: '',
        targetScore: 5,
        targetWin: 3,
        targetOptions: [3, 5, 7, 9],
        scoreConfigExpanded: false,
        scoreItems: [] as Array<{ key: string; label: string; value: number }>,
        players: [] as RoomPlayer[],
        canAddPlayer: true,
        canDeletePlayer: false,
        swipedPlayerId: 0,
        showAddModal: false,
        addingName: '',
        showEditModal: false,
        editingPlayerId: 0,
        editingName: '',
        editingOriginalName: '',
        showDeleteModal: false,
        isDeletingMatch: false,
    },

    _saveQueue: Promise.resolve(true),
    _match: null as Match | null,

    // ===== 滑动手势 =====

    _touchStartX: 0,
    _touchStartY: 0,

    onPlayerTouchStart(e: WechatMiniprogram.TouchEvent) {
        this._touchStartX = e.touches[0].clientX
        this._touchStartY = e.touches[0].clientY
    },

    onPlayerTouchEnd(e: WechatMiniprogram.TouchEvent) {
        var endX = e.changedTouches[0].clientX
        var endY = e.changedTouches[0].clientY
        var deltaX = endX - this._touchStartX
        var deltaY = endY - this._touchStartY
        var playerId = Number(e.currentTarget.dataset.playerId)

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
            if (deltaX < 0 && this.data.canDeletePlayer) {
                this.setData({ swipedPlayerId: playerId })
            } else {
                this.setData({ swipedPlayerId: 0 })
            }
        }
    },

    handleCloseSwipe() {
        if (this.data.swipedPlayerId) {
            this.setData({ swipedPlayerId: 0 })
        }
    },

    onLoad(options: Record<string, string>) {
        var matchId = Number(options.matchId || 0)
        var match = gameStore.getCurrentMatch()
        if (!match || match.id !== matchId) {
            wx.showToast({ title: '对局不存在', icon: 'none' })
            setTimeout(function () { wx.navigateBack() }, 300)
            return
        }
        this.applyMatchToForm(match)
    },

    /** 将对局数据应用到表单 */
    applyMatchToForm(match: Match) {
        this._match = match
        var modeId = matchTypeToModeMap[match.match_type] || 'nine-ball'
        var mode = null as typeof NineBallGame | null
        for (var i = 0; i < GAME_MODES.length; i++) {
            if (GAME_MODES[i].id === modeId) { mode = GAME_MODES[i]; break }
        }
        if (!mode) { mode = NineBallGame }

        var isNineBall = modeId === 'nine-ball'
        var scoreItems: Array<{ key: string; label: string; value: number }> = []
        if (isNineBall) {
            var configData = (match.config && match.config.data) ? match.config.data : undefined
            var scores = extractNineBallScores(configData)
            for (var j = 0; j < nineBallScoreKeys.length; j++) {
                var sk = nineBallScoreKeys[j]
                scoreItems.push({ key: sk, label: nineBallScoreLabels[sk], value: scores[sk] })
            }
        }

        this.setData({
            matchId: match.id,
            matchIdText: '#' + match.id,
            modeBadge: mode.badge,
            modeTitle: mode.title,
            modeDesc: mode.desc,
            modeMaxPlayers: mode.maxPlayers,
            modeMeta: '最多 ' + mode.maxPlayers + ' 人',
            isNineBall: isNineBall,
            isSnooker: modeId === 'snooker',
            redCount: String(match.config.data?.red_count ?? 15),
            maximumBreak: String(maximumSnookerBreak(Number(match.config.data?.red_count ?? 15))),
            targetOptions: modeId === 'snooker' ? [1, 3, 5, 7, 9] : [3, 5, 7, 9],
            roomName: (match.name || '').trim(),
            targetScore: match.config ? match.config.target_score : 5,
            targetWin: calcTargetWin(match.config ? match.config.target_score : 5),
            scoreItems: scoreItems,
        })
        this.applyPlayersToForm(match.players)
    },

    /** 球员接口只更新球员，保留正在编辑的房间配置。 */
    applyPlayersToForm(players: Match['players']) {
        if (!this._match) return
        this._match = { ...this._match, players: players }
        gameStore.setCurrentMatch(this._match)
        this.setData({
            players: players.map(function (player, index) {
                return {
                    id: player.id || (index + 1),
                    nick_name: player.nick_name || ('玩家 ' + (index + 1)),
                    player_code: player.code || '',
                }
            }),
            canAddPlayer: players.length < this.data.modeMaxPlayers,
            canDeletePlayer: players.length > 1,
        })
    },

    // ===== 目标局数 =====

    handleSelectTarget(e: WechatMiniprogram.TouchEvent) {
        if (this.data.isStarting) return
        var option = Number(e.currentTarget.dataset.option)
        if (!option || option <= 0) { return }
        this.setData({ targetScore: option, targetWin: calcTargetWin(option) })
        this.updateMatchIfChanged()
    },

    handleTargetInput(e: WechatMiniprogram.Input) {
        if (this.data.isStarting) return
        var value = Number(e.detail.value)
        if (this.data.isSnooker || value > 0) {
            this.setData({ targetScore: value, targetWin: calcTargetWin(value) })
        }
    },

    handleTargetBlur() {
        if (this.data.isStarting) return
        var value = this.data.targetScore
        if (!this.data.isSnooker && value > 0 && value % 2 === 0) {
            var adjusted = value - 1
            if (adjusted <= 0) { adjusted = 1 }
            this.setData({ targetScore: adjusted, targetWin: calcTargetWin(adjusted) })
        }
        this.updateMatchIfChanged()
    },

    // ===== 房间名称 =====

    handleNameInput(e: WechatMiniprogram.Input) {
        if (this.data.isStarting) return
        this.setData({ roomName: e.detail.value })
    },

    handleNameBlur() {
        if (this.data.isStarting) return
        this.updateMatchIfChanged()
    },

    // ===== 分数配置 =====

    handleToggleScoreConfig() {
        this.setData({ scoreConfigExpanded: !this.data.scoreConfigExpanded })
    },

    handleScoreInput(e: WechatMiniprogram.Input) {
        if (this.data.isStarting) return
        var key = String(e.currentTarget.dataset.key || '')
        var value = Number(e.detail.value)
        if (!key) { return }
        var items = this.data.scoreItems.slice()
        for (var i = 0; i < items.length; i++) {
            if (items[i].key === key) {
                items[i] = { key: items[i].key, label: items[i].label, value: isFinite(value) ? value : 0 }
                break
            }
        }
        this.setData({ scoreItems: items })
    },

    handleScoreBlur() {
        if (this.data.isStarting) return
        this.updateMatchIfChanged()
    },

    // ===== 更新对局 =====

    updateMatchIfChanged(withLoading = true): Promise<boolean> {
        var matchId = this.data.matchId
        var name = this.data.roomName.trim()
        var target = this.data.targetScore
        var redCount = Number(this.data.redCount)
        var error = ''
        if (!name) error = '请输入房间名称'
        else if (!Number.isInteger(target) || target < 1) error = '请输入有效的目标局数'
        else if (this.data.isSnooker && (target > 35 || target % 2 === 0))
            error = '斯诺克赛制必须为 1 到 35 的奇数局'
        else if (this.data.isSnooker && (!Number.isInteger(redCount) || redCount < 1 || redCount > 15))
            error = '红球数量必须为 1 到 15 的整数'
        this.setData({ formError: error })
        if (!matchId || error) return Promise.resolve(false)
        var configData: Record<string, unknown> | undefined
        if (this.data.isNineBall && this.data.scoreItems.length > 0) {
            configData = {}
            for (var i = 0; i < this.data.scoreItems.length; i++) {
                var item = this.data.scoreItems[i]
                configData[item.key] = item.value
            }
        } else if (this.data.isSnooker) {
            configData = { ...this._match?.config.data, red_count: redCount }
        }
        // 串行保存，确保开始比赛前最后一次表单修改已写入服务端。
        this._saveQueue = this._saveQueue.then(async () => {
            if (withLoading) wx.showLoading({ title: '保存中', mask: true })
            try {
                var match = await updateMatch({ match_id: matchId, name: name, target_score: target, config_data: configData })
                // 更新接口不加载球员，不能用返回的空 players 覆盖房间缓存。
                if (this._match) {
                    this._match = { ...this._match, name: match.name, config: match.config }
                    gameStore.setCurrentMatch(this._match)
                }
                return true
            } catch (err) {
                this.setData({ formError: (err as Error).message || '保存失败，请重试' })
                return false
            } finally {
                if (withLoading) wx.hideLoading()
            }
        })
        return this._saveQueue
    },

    handleRedCountInput(e: WechatMiniprogram.Input) {
        if (this.data.isStarting) return
        this.setRedCount(e.detail.value)
    },

    handleSelectRedCount(e: WechatMiniprogram.TouchEvent) {
        if (this.data.isStarting) return
        this.setRedCount(String(e.currentTarget.dataset.count))
        this.updateMatchIfChanged()
    },

    setRedCount(value: string) {
        var count = Number(value)
        var valid = Number.isInteger(count) && count >= 1 && count <= 15
        this.setData({
            redCount: value,
            maximumBreak: valid ? String(maximumSnookerBreak(count)) : '—',
        })
    },

    handleRedCountBlur() {
        if (this.data.isStarting) return
        this.updateMatchIfChanged()
    },

    // ===== 添加球员 =====

    handleOpenAdd() {
        if (this.data.isStarting || this.data.isPlayerPending) return
        if (!this.data.canAddPlayer) { return }
        var names = this.data.players.map(function (p) { return p.nick_name })
        var nextId = this.data.players.length + 1
        var defaultName = buildRandomPlayerName(names, nextId)
        this.setData({ showAddModal: true, addingName: defaultName })
    },

    handleCloseAdd() {
        if (this.data.isPlayerPending) return
        this.setData({ showAddModal: false, addingName: '' })
    },

    handleAddNameInput(e: WechatMiniprogram.Input) {
        if (this.data.isPlayerPending) return
        this.setData({ addingName: e.detail.value })
    },

    async handleConfirmAdd() {
        var matchId = this.data.matchId
        if (!matchId || this.data.isStarting || this.data.isPlayerPending || !this.data.canAddPlayer) { return }
        var name = this.data.addingName.trim()
        if (!name) {
            wx.showToast({ title: '请输入球员名称', icon: 'none' })
            return
        }
        this.setData({ isPlayerPending: true })
        wx.showLoading({ title: '添加中', mask: true })
        try {
            var match = await joinMatch({ match_id: matchId, nick_name: name, player_type: 1 })
            this.applyPlayersToForm(match.players)
            this.setData({ showAddModal: false, addingName: '' })
        } catch (err) {
            console.error('添加球员失败', err)
            wx.showToast({ title: (err as Error).message || '添加失败', icon: 'none' })
        } finally {
            wx.hideLoading()
            this.setData({ isPlayerPending: false })
        }
    },

    // ===== 编辑球员 =====

    handleOpenEdit(e: WechatMiniprogram.TouchEvent) {
        if (this.data.isStarting) return
        var playerId = Number(e.currentTarget.dataset.playerId)
        var playerName = String(e.currentTarget.dataset.playerName || '')
        this.setData({
            showEditModal: true,
            editingPlayerId: playerId,
            editingName: playerName,
            editingOriginalName: playerName,
        })
    },

    handleCloseEdit() {
        this.setData({ showEditModal: false, editingPlayerId: 0, editingName: '', editingOriginalName: '' })
    },

    handleEditNameInput(e: WechatMiniprogram.Input) {
        this.setData({ editingName: e.detail.value })
    },

    handleSaveEdit() {
        var playerId = this.data.editingPlayerId
        if (!playerId) { this.handleCloseEdit(); return }
        var name = this.data.editingName.trim() || this.data.editingOriginalName
        var players = this.data.players.slice()
        for (var i = 0; i < players.length; i++) {
            if (players[i].id === playerId) {
                players[i] = { id: players[i].id, nick_name: name, player_code: players[i].player_code }
                break
            }
        }
        this.setData({ players: players })
        this.handleCloseEdit()
    },

    // ===== 删除球员 =====

    async handleDeletePlayer(e: WechatMiniprogram.TouchEvent) {
        if (this.data.isStarting || this.data.isPlayerPending) return
        if (!this.data.canDeletePlayer) { return }
        var playerId = Number(e.currentTarget.dataset.playerId)
        var player: RoomPlayer | null = null
        for (var i = 0; i < this.data.players.length; i++) {
            if (this.data.players[i].id === playerId) { player = this.data.players[i]; break }
        }
        if (!player) { return }

        this.setData({ swipedPlayerId: 0 })
        var matchId = this.data.matchId
        if (matchId && player.player_code) {
            this.setData({ isPlayerPending: true })
            wx.showLoading({ title: '删除中', mask: true })
            try {
                await leaveMatch({ match_id: matchId, player_code: player.player_code })
                if (this._match) {
                    var players: Match['players'] = this._match.players
                    this.applyPlayersToForm(players.filter(function (item) { return item.id !== playerId }))
                }
            } catch (err) {
                console.error('删除球员失败', err)
                wx.showToast({ title: (err as Error).message || '删除失败', icon: 'none' })
            } finally {
                wx.hideLoading()
                this.setData({ isPlayerPending: false })
            }
        } else {
            var filtered = this.data.players.filter(function (p) { return p.id !== playerId })
            this.setData({
                players: filtered,
                canAddPlayer: filtered.length < this.data.modeMaxPlayers,
                canDeletePlayer: filtered.length > 1,
            })
        }
    },

    // ===== 开始对局 =====

    async handleStartGame() {
        var matchId = this.data.matchId
        if (!matchId || this.data.isStarting || this.data.isPlayerPending) { return }
        if (this.data.players.length < 2) {
            this.setData({ formError: '请至少添加 2 名球员' })
            return
        }
        this.setData({ isStarting: true })
        try {
            // 等前面的保存收起提示，再由开始流程统一管理 loading。
            await this._saveQueue
            wx.showLoading({ title: '开始中', mask: true })
            if (!await this.updateMatchIfChanged(false)) { return }
            var match = await startMatch({ match_id: matchId })
            if (match) {
                gameStore.setCurrentMatch(match)
            }
            var matchType = match?.match_type
                || gameStore.getCurrentMatch()?.match_type
                || '9ball'
            var route = matchTypeToRouteMap[matchType] || '/package-game/pages/nine-ball-game/nine-ball-game'
            wx.redirectTo({ url: route + '?matchId=' + matchId })
        } catch (err) {
            console.error('开始对局失败', err)
            wx.showToast({ title: (err as Error).message || '开始失败', icon: 'none' })
        } finally {
            wx.hideLoading()
            this.setData({ isStarting: false })
        }
    },

    // ===== 删除对局 =====

    handleOpenDeleteMatch() {
        if (this.data.isStarting) return
        if (this.data.isDeletingMatch) { return }
        this.setData({ showDeleteModal: true })
    },

    handleCloseDeleteMatch() {
        if (this.data.isDeletingMatch) { return }
        this.setData({ showDeleteModal: false })
    },

    async handleConfirmDeleteMatch() {
        var matchId = this.data.matchId
        if (!matchId || this.data.isDeletingMatch) { return }
        this.setData({ isDeletingMatch: true })
        wx.showLoading({ title: '删除中', mask: true })
        try {
            await deleteMatch({ match_id: matchId })
            gameStore.clearCurrentMatch()
            wx.navigateBack()
        } catch (err) {
            console.error('删除对局失败', err)
            wx.showToast({ title: (err as Error).message || '删除失败', icon: 'none' })
        } finally {
            wx.hideLoading()
            this.setData({ isDeletingMatch: false, showDeleteModal: false })
        }
    },

    /** 分享给朋友 */
    onShareAppMessage() {
        var title = this.data.roomName
            ? this.data.roomName + ' - 来一起打球吧'
            : '台球计分助手 - 一起来打球吧'
        return {
            title: title,
            path: '/pages/home/home',
        }
    },
})
