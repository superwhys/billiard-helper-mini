const { test } = require('node:test')
const assert = require('node:assert/strict')
const { harness, match, event } = require('./page-harness.cjs')

function roomApp(players) {
    const app = harness()
    const initial = match({ status: 1, ...(players ? { players } : {}) })
    app.storage.set('billiard_current_match', initial)
    const room = app.page('package-game/pages/create-room/create-room.ts')
    room.onLoad({ matchId: '13' })
    return { app, room, initial }
}

test('配置接口不返回球员时保存仍保留当前房间球员', async () => {
    const { app, room, initial } = roomApp()
    app.respond = ({ path, data }) => {
        assert.equal(path, '/match/update')
        return { ...initial, players: [], config: { ...initial.config, data: data.config_data } }
    }
    room.handleRedCountInput(event({}, '10'))
    await room.updateMatchIfChanged()
    assert.equal(app.storage.get('billiard_current_match').players.length, 2)
    assert.equal(app.storage.get('billiard_current_match').config.data.red_count, 10)
})

test('加入球员与配置保存交错时保留最新表单、已存配置与球员', async () => {
    const { app, room, initial } = roomApp([{ id: 1, code: 'a', nick_name: '阿文' }])
    let releaseSave
    app.respond = ({ path, data }) => {
        if (path === '/match/update') return new Promise((resolve) => {
            releaseSave = () => resolve({ ...initial, players: [], config: { ...initial.config, data: data.config_data } })
        })
        assert.equal(path, '/match/join')
        return { ...initial, players: [...initial.players, { id: 2, code: 'b', nick_name: '小林' }] }
    }
    room.handleRedCountInput(event({}, '10'))
    const saving = room.updateMatchIfChanged()
    await new Promise(setImmediate)
    room.handleRedCountInput(event({}, '15')) // 保存途中继续编辑，加入响应不能重置输入。
    room.handleAddNameInput(event({}, '小林'))
    await room.handleConfirmAdd()
    assert.equal(room.data.redCount, '15')
    releaseSave()
    await saving
    const stored = app.storage.get('billiard_current_match')
    assert.equal(stored.config.data.red_count, 10)
    assert.equal(stored.players.length, 2)
    assert.equal(room.data.redCount, '15')
})

test('删除球员空返回后更新球员，无需额外请求，处理中不能开始比赛', async () => {
    const { app, room } = roomApp()
    let releaseDelete
    app.respond = ({ path }) => {
        if (path === '/match/leave') return new Promise((resolve) => { releaseDelete = () => resolve(undefined) })
        throw new Error('删除球员不应额外发起请求：' + path)
    }
    const deleting = room.handleDeletePlayer(event({ playerId: 2 }))
    await new Promise(setImmediate)
    await room.handleStartGame()
    assert.deepEqual(app.requests.map((request) => request.path), ['/match/leave'])
    releaseDelete()
    await deleting
    assert.equal(room.data.players.length, 1)
    assert.equal(room.data.canAddPlayer, true)
    assert.equal(app.storage.get('billiard_current_match').players.length, 1)
    assert.equal(room.data.isPlayerPending, false)
    assert.deepEqual(app.requests.map((request) => request.path), ['/match/leave'])
})
