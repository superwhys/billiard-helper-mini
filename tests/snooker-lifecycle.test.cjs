const { test } = require('node:test')
const assert = require('node:assert/strict')
const { harness, match, snapshot, event } = require('./page-harness.cjs')

const initial = match({ current_scores: snapshot({ can_undo: true }, 8) })
const cases = [
    { name: '初次加载进行中的比赛', initialLoad: true, run: (page) => page.loadMatch(), response: initial },
    { name: '初次加载已结束的比赛', initialLoad: true, run: (page) => page.loadMatch(), response: match({ status: 3 }) },
    { name: '普通计分', run: (page) => page.handleBall(event({ key: 'red' })),
        response: snapshot({ next_ball: 'colour', reds_remaining: 5, can_undo: true }, 9) },
    { name: '换人', run: (page) => page.handleSwitch(event()),
        response: snapshot({ active_player_id: 2, can_undo: true }, 8) },
    { name: '撤销', run: (page) => page.handleUndo(), response: snapshot() },
    { name: '整场结算', run: (page) => {
        page.handleOpenDialog(event({ dialog: 'settle' }))
        return page.handleConfirm()
    }, response: match({ status: 3 }) },
]

for (const scenario of cases) {
    for (const failed of [false, true]) {
        test(`${scenario.name}的${failed ? '失败' : '成功'}响应在页面卸载后不再更新页面、缓存或导航`, async () => {
            const app = harness()
            const page = app.page('package-game/pages/snooker-game/snooker-game.ts')
            page.onLoad({ matchId: '13' })
            if (!scenario.initialLoad) {
                app.respond = () => initial
                await page.loadMatch()
            }

            let resolveRequest, rejectRequest
            app.respond = () => new Promise((resolve, reject) => {
                resolveRequest = resolve
                rejectRequest = reject
            })
            const pending = scenario.run(page)
            await new Promise(setImmediate)
            assert.equal(typeof resolveRequest, 'function', '请求应在卸载前发出')
            page.onUnload()

            const currentMatch = match({ id: 99, name: '另一个房间', status: 1 })
            app.storage.set('billiard_current_match', currentMatch)
            const updates = []
            page.setData = (value) => updates.push(value)
            if (failed) rejectRequest(new Error('延迟失败'))
            else resolveRequest(scenario.response)
            await pending

            assert.deepEqual({ updates, navigations: app.navigations,
                currentMatch: app.storage.get('billiard_current_match') },
            { updates: [], navigations: [], currentMatch })
        })
    }
}
