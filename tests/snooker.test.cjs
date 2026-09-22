const { test } = require('node:test')
const assert = require('node:assert/strict')
const { harness, snapshot, match, scoring, event } = require('./page-harness.cjs')

// 快照直接描述现有服务端协议，测试小程序行为，不在客户端重写计分规则。
test('红彩交替、所有球色分值、完整清彩和结束后撤销', async () => {
    const { app, page } = await scoring(match({ current_scores: snapshot({ red_count: 1, reds_remaining: 1, remaining_points: 35 }) }))
    const responses = [
        snapshot({ red_count: 1, reds_remaining: 0, next_ball: 'colour', break_score: 1, remaining_points: 34, can_undo: true }, 1),
        ...['yellow', 'green', 'brown', 'blue', 'pink', 'black', 'done'].map((next, index) => {
            const score = [8, 10, 13, 17, 22, 28, 35][index]
            return snapshot({ red_count: 1, reds_remaining: 0, next_ball: next, break_score: score, remaining_points: 35 - score, can_undo: true }, score)
        }),
    ]
    const keys = ['red', 'black', 'yellow', 'green', 'brown', 'blue', 'pink', 'black']
    const points = [1, 7, 2, 3, 4, 5, 6, 7]
    app.respond = ({ path, data }) => {
        assert.equal(path, '/score/sync')
        const index = app.requests.filter((request) => request.path === path).length - 1
        assert.equal(data.round, 1)
        assert.deepEqual(data.context, { stat_key: keys[index], scorer_player_id: 1 })
        assert.deepEqual(data.score_actions, [{ player_ids: [1], score: points[index] }])
        return responses[index]
    }
    await page.handleBall(event({ key: 'black' }))
    assert.equal(app.requests.length, 1, '不能跳过红球')
    for (let i = 0; i < keys.length; i++) {
        await page.handleBall(event({ key: keys[i] }))
        assert.equal(page.data.players[0].score, responses[i][1].score)
        assert.equal(page.data.table.remaining_points, responses[i]._snooker.remaining_points)
    }
    assert.equal(page.data.table.next_ball, 'done')
    assert.equal(page.data.balls.some((ball) => ball.allowed), false)
    await page.handleBall(event({ key: 'black' }))
    assert.equal(app.requests.length, 9)
    app.respond = ({ path, data }) => {
        assert.equal(path, '/score/undo')
        assert.deepEqual(data, { match_id: 13, round: 1 })
        return responses[6]
    }
    await page.handleUndo()
    assert.equal(page.data.table.next_ball, 'black')
    assert.equal(page.data.table.break_score, 28)
    assert.equal(page.data.balls.find((ball) => ball.key === 'black').allowed, true)
})

test('犯规给对手加分、离台红球校验、要求继续击球及撤销完整恢复', async () => {
    const initial = snapshot({ reds_remaining: 5, break_score: 8, remaining_points: 67, can_undo: true }, 8)
    const { app, page } = await scoring(match({ current_scores: initial }))
    page.handleOpenDialog(event({ dialog: 'foul' }))
    for (const value of ['-1', '6', '1.5', 'abc']) {
        page.handleRedsRemoved(event({}, value))
        await page.handleConfirm()
        assert.match(page.data.error, /离台红球数/)
    }
    assert.equal(app.requests.length, 1)
    page.handleRedsRemoved(event({}, '1'))
    page.handleReplayFoul(event({}, true))
    page.handlePenalty(event({ penalty: 7 }))
    app.respond = ({ path, data }) => {
        assert.equal(path, '/score/sync')
        assert.deepEqual(data.context, { stat_key: 'foul', scorer_player_id: 1, reds_removed: 1, next_player_id: 1 })
        assert.deepEqual(data.score_actions, [{ player_ids: [2], score: 7 }])
        return snapshot({ reds_remaining: 4, remaining_points: 59, can_undo: true }, 8, 7)
    }
    await page.handleConfirm()
    assert.equal(page.data.players[0].score, 8)
    assert.equal(page.data.players[1].score, 7)
    assert.equal(page.data.table.break_score, 0)
    assert.equal(page.data.dialog, '')
    app.respond = () => initial
    await page.handleUndo()
    assert.deepEqual(page.data.table, initial._snooker)
    assert.equal(page.data.players[1].score, 0)
})

test('换人发送 turn_end，撤销恢复击球球员及单杆；刷新加载服务器状态', async () => {
    const initial = snapshot({ next_ball: 'colour', reds_remaining: 5, break_score: 1, remaining_points: 74, can_undo: true }, 1)
    const { app, page } = await scoring(match({ current_scores: initial }))
    app.respond = ({ data }) => {
        assert.deepEqual(data.context, { stat_key: 'turn_end', scorer_player_id: 1, next_player_id: 2 })
        assert.deepEqual(data.score_actions, [])
        return snapshot({ active_player_id: 2, reds_remaining: 5, remaining_points: 67, can_undo: true }, 1)
    }
    await page.handleSwitch(event())
    assert.equal(page.data.selectedId, 2)
    assert.equal(page.data.table.break_score, 0)
    app.respond = () => initial
    await page.handleUndo()
    assert.equal(page.data.selectedId, 1)
    assert.equal(page.data.table.break_score, 1)
    app.respond = () => match({ current_scores: snapshot({ active_player_id: 2, break_score: 9 }, 1, 9) })
    await page.loadMatch()
    assert.equal(page.data.selectedId, 2)
    assert.equal(page.data.players[1].score, 9)
})

test('清彩最低罚分、重置黑球、平分禁止直接结算', async () => {
    const { page } = await scoring()
    for (const [next, minimum] of [['yellow', 4], ['blue', 5], ['pink', 6], ['black', 7], ['respotted_black', 7]]) {
        page.applyMatch(match({ current_scores: snapshot({ next_ball: next, reds_remaining: 0 }, 20, 20) }))
        page.handleOpenDialog(event({ dialog: 'foul' }))
        assert.equal(page.data.penalty, minimum)
        assert.deepEqual(page.data.penaltyOptions, [4, 5, 6, 7].filter((value) => value >= minimum))
        page.handleCloseDialog()
    }
    assert.deepEqual(page.data.balls.filter((ball) => ball.allowed).map((ball) => ball.key), ['black'])
    assert.match(page.data.targetLabel, /平分重置黑球/)
    page.handleOpenDialog(event({ dialog: 'settle' }))
    assert.equal(page.data.dialog, '')
    page.handleOpenDialog(event({ dialog: 'concede' }))
    assert.equal(page.data.dialog, 'concede')
})

test('结算进入下一局，认输保留实际比分，整场结束跳转详情', async () => {
    const { app, page } = await scoring(match({ current_scores: snapshot({}, 8) }))
    const firstFrame = { id: 11, game_num: 1, end_at: 100, winner_id: 1, scores: snapshot({}, 8) }
    page.handleOpenDialog(event({ dialog: 'settle' }))
    page.handleCloseDialog()
    assert.equal(app.requests.length, 1)
    page.handleOpenDialog(event({ dialog: 'settle' }))
    app.respond = ({ path, data }) => {
        assert.equal(path, '/match/round/next')
        assert.deepEqual(data, { match_id: 13, round: 1 })
        return match({ match_round: 2, match_games: [firstFrame] })
    }
    await page.handleConfirm()
    assert.equal(page.data.currentRound, 2)
    assert.equal(page.data.players[0].frames, 1)
    assert.equal(page.data.players[0].score, 0)
    assert.equal(page.data.canUndo, false)
    const final = match({ status: 3, match_round: 2, winner_id: 1, winner_score: 2, match_games: [firstFrame,
        { id: 12, game_num: 2, end_at: 200, winner_id: 1, scores: snapshot({}, 0, 9) }] })
    page.applyMatch(match({ match_round: 2, current_scores: snapshot({ active_player_id: 2 }, 0, 9), match_games: [firstFrame] }))
    page.handleOpenDialog(event({ dialog: 'concede' }))
    app.respond = ({ data }) => {
        assert.deepEqual(data, { match_id: 13, round: 2, conceding_player_id: 2 })
        return final
    }
    await page.handleConfirm()
    assert.equal(page.data.ready, false)
    assert.match(app.navigations.at(-1), /record-detail\?matchId=13$/)
    const detail = app.page('package-record/pages/record-detail/record-detail.ts')
    detail.applyMatchDetail(final)
    assert.equal(detail.data.players[0].scoreText, '2 局')
    assert.equal(detail.data.resultText, '阿文 胜')
    assert.match(detail.data.timelines[0].desc, /阿文 0 \/ 小林 9/)
    assert.match(detail.data.timelines[0].desc, /阿文 胜/)
})

test('请求等待期间防重复点击；失败不改分且刷新前禁用操作；断网及监听清理', async () => {
    const { app, page } = await scoring()
    let release
    app.respond = () => new Promise((resolve) => { release = resolve })
    const pending = page.handleBall(event({ key: 'red' }))
    await page.handleBall(event({ key: 'red' }))
    await new Promise(setImmediate)
    assert.equal(app.requests.length, 2)
    assert.equal(page.data.players[0].score, 0)
    release(snapshot({ next_ball: 'colour', reds_remaining: 5, break_score: 1, can_undo: true }, 1))
    await pending
    app.respond = () => { throw new Error('计分失败') }
    await page.handleBall(event({ key: 'black' }))
    assert.equal(page.data.players[0].score, 1)
    assert.match(page.data.error, /计分失败/)
    assert.equal(page.data.needsRefresh, true)
    const count = app.requests.length
    await page.handleBall(event({ key: 'black' }))
    assert.equal(app.requests.length, count)
    app.respond = () => match()
    await page.loadMatch()
    assert.equal(page.data.needsRefresh, false)
    app.network(false)
    await page.handleBall(event({ key: 'red' }))
    assert.equal(page.data.online, false)
    assert.equal(app.requests.length, count + 1)
    page.onUnload()
    assert.equal(app.hasNetworkListener(), false)
})

test('无效台面或分数不覆盖有效快照；旧局手动记分不伪造台面', async () => {
    const { app, page } = await scoring()
    app.respond = () => snapshot({ next_ball: 'invalid' }, 999)
    await page.handleBall(event({ key: 'red' }))
    assert.equal(page.data.players[0].score, 0)
    assert.equal(page.data.needsRefresh, true)
    for (const bad of [null, {}, { 1: { score: 1 } }, snapshot({ red_count: 0 }), snapshot({ reds_remaining: 16 })]) {
        assert.throws(() => page.applyScores(bad))
        assert.equal(page.data.players[0].score, 0)
    }
    const legacy = snapshot({}, 12, 5)
    delete legacy._snooker
    app.respond = () => match({ current_scores: legacy })
    await page.loadMatch()
    assert.equal(page.data.table, null)
    assert.equal(page.data.balls.every((ball) => ball.allowed), true)
    await page.handleSwitch(event({ id: 2 }))
    const count = app.requests.length
    app.respond = ({ data }) => {
        assert.deepEqual(data.context, { stat_key: 'foul', scorer_player_id: 2 })
        assert.deepEqual(data.score_actions, [{ player_ids: [1], score: 4 }])
        return { 1: { score: 16, extra: {} }, 2: { score: 5, extra: {} } }
    }
    page.handleOpenDialog(event({ dialog: 'foul' }))
    await page.handleConfirm()
    assert.equal(app.requests.length, count + 1)
    assert.equal(page.data.players[0].score, 16)
})

test('建局红球满分预览、非法红球和局数阻止开始；保存失败不能使用旧配置开始', async () => {
    const app = harness()
    const room = app.page('package-game/pages/create-room/create-room.ts')
    const initial = match({ status: 1 })
    app.storage.set('billiard_current_match', initial)
    room.onLoad({ matchId: '13' })
    for (const [reds, maximum] of [['1', '35'], ['6', '75'], ['10', '107'], ['15', '147']]) {
        room.handleRedCountInput(event({}, reds))
        assert.equal(room.data.maximumBreak, maximum)
    }
    for (const invalid of ['', '0', '16', '2.5', 'NaN']) {
        room.handleRedCountInput(event({}, invalid))
        await room.handleStartGame()
        assert.match(room.data.formError, /红球数量/)
    }
    room.handleRedCountInput(event({}, '6'))
    for (const invalid of ['', '0', '2', '36', '3.5']) {
        room.handleTargetInput(event({}, invalid))
        await room.handleStartGame()
        assert.match(room.data.formError, /局数|奇数局/)
    }
    assert.equal(app.requests.length, 0)
    room.handleTargetInput(event({}, '3'))
    app.respond = () => { throw new Error('保存失败') }
    await room.handleStartGame()
    assert.deepEqual(app.requests.map((request) => request.path), ['/match/update'])
    assert.equal(room.data.isStarting, false)
    assert.match(room.data.formError, /保存失败/)
    app.respond = ({ path, data }) => {
        if (path === '/match/update') {
            assert.equal(data.config_data.red_count, 6)
            assert.equal(data.target_score, 3)
            return initial
        }
        assert.equal(path, '/match/start')
        return null // 真实开始接口没有 Match 返回体。
    }
    await room.handleStartGame()
    assert.match(app.navigations.at(-1), /snooker-game\?matchId=13$/)
})

test('首页和记录入口可创建、继续、回看斯诺克；九球和中八原路由保持可用', async () => {
    const app = harness()
    const initial = match()
    app.respond = ({ path, data }) => {
        if (path === '/account/me') return { id: 7, name: '阿文' }
        if (path === '/match/list') return [initial]
        if (path === '/match/create') {
            assert.equal(data.match_type, 'snooker')
            assert.equal(data.max_players, 2)
            return { ...initial, status: 1 }
        }
        throw new Error(path)
    }
    const home = app.page('pages/home/home.ts')
    home.handleSelectMode(event({ modeId: 'snooker' }))
    assert.equal(home.data.activeModeId, 'snooker')
    await home.handleCreateRoom()
    assert.match(app.navigations.at(-1), /create-room\?matchId=13$/)
    for (const file of ['pages/home/home.ts', 'pages/records/records.ts']) {
        const page = app.page(file)
        for (const [type, route] of [['snooker', 'snooker-game'], ['9ball', 'nine-ball-game'], ['8ball', 'eight-ball-game']]) {
            const record = { id: 13, status: 2, matchType: type }
            page.setData(file.includes('/home/') ? { recentRecords: [record] } : { recordList: [record] })
            page.handleRecordTap({ detail: { recordId: 13 } })
            assert.match(app.navigations.at(-1), new RegExp(route + '\\?matchId=13$'))
        }
    }
})

test('仅从服务端当前局恢复，非进行中的对局重定向', async () => {
    const current = snapshot({ break_score: 8, can_undo: true }, 8)
    const { page } = await scoring(match({ current_scores: undefined,
        match_games: [{ id: 11, game_num: 1, end_at: 0, scores: current }] }))
    assert.equal(page.data.players[0].score, 8)
    for (const [status, route] of [[1, 'create-room'], [3, 'record-detail']]) {
        const { app, page } = await scoring(match({ status }))
        assert.equal(page.data.ready, false)
        assert.match(app.navigations.at(-1), new RegExp(route + '\\?matchId=13$'))
    }
})

test('连续改配置按顺序保存，开始等待最终保存且阻止重复提交', async () => {
    const app = harness()
    const room = app.page('package-game/pages/create-room/create-room.ts')
    const initial = match({ status: 1, config: { max_players: 2, target_score: 35, data: { red_count: 6, retained: true } } })
    app.storage.set('billiard_current_match', initial)
    room.onLoad({ matchId: '13' })
    let release
    app.respond = ({ path, data }) => {
        if (path === '/match/start') return null
        assert.equal(path, '/match/update')
        assert.equal(data.config_data.retained, true)
        if (data.config_data.red_count === 6) return new Promise((resolve) => { release = resolve })
        assert.equal(data.config_data.red_count, 10)
        return { ...initial, config: { ...initial.config, data: data.config_data } }
    }
    const saving = room.updateMatchIfChanged()
    await new Promise(setImmediate)
    room.handleRedCountInput(event({}, '10'))
    const starting = room.handleStartGame()
    await room.handleStartGame()
    room.handleRedCountInput(event({}, '15'))
    assert.equal(room.data.redCount, '10', '开始期间不允许再修改配置')
    assert.equal(app.requests.length, 1)
    release(initial)
    await saving
    await starting
    assert.deepEqual(app.requests.map((request) => request.path), ['/match/update', '/match/update', '/match/start'])
    assert.match(app.navigations.at(-1), /snooker-game\?matchId=13$/)
})

test('普通犯规默认交给对手，重置黑球进球后允许结算', async () => {
    const { app, page } = await scoring()
    page.handleOpenDialog(event({ dialog: 'foul' }))
    app.respond = ({ data }) => {
        assert.deepEqual(data.context, { stat_key: 'foul', scorer_player_id: 1, reds_removed: 0, next_player_id: 2 })
        return snapshot({ active_player_id: 2, can_undo: true }, 0, 4)
    }
    await page.handleConfirm()
    assert.equal(page.data.selectedId, 2)
    page.applyMatch(match({ current_scores: snapshot({ next_ball: 'respotted_black', reds_remaining: 0, remaining_points: 7 }, 20, 20) }))
    app.respond = ({ data }) => {
        assert.deepEqual(data.score_actions, [{ player_ids: [1], score: 7 }])
        return snapshot({ next_ball: 'done', reds_remaining: 0, remaining_points: 0, can_undo: true }, 27, 20)
    }
    await page.handleBall(event({ key: 'black' }))
    page.handleOpenDialog(event({ dialog: 'settle' }))
    assert.equal(page.data.dialog, 'settle')
    assert.equal(page.data.leaderName, '阿文')
})

test('历史列表缺少逐局明细时保留服务端汇总胜局', async () => {
    const app = harness()
    const final = match({ status: 3, match_games: undefined, winner_id: 1, winner_score: 2,
        players: [{ id: 1, nick_name: '阿文', scores: 2 }, { id: 2, nick_name: '小林', scores: 1 }] })
    app.respond = ({ path }) => {
        assert.equal(path, '/match/list')
        return [final]
    }
    const records = app.page('pages/records/records.ts')
    await records.loadRecords(true)
    assert.deepEqual(records.data.recordList[0].players.map((player) => player.score), [2, 1])
    const detail = app.page('package-record/pages/record-detail/record-detail.ts')
    detail.applyMatchDetail(final)
    assert.deepEqual(detail.data.players.map((player) => player.scoreText), ['2 局', '1 局'])
})
