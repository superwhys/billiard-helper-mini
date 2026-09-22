// 使用微信开发者工具自带编译器验证模板及实际生成的 WXML 节点。
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const { scoring, harness, match, snapshot, event } = require('../tests/page-harness.cjs')

const bin = process.env.WECHAT_COMPILER_DIR
    || '/Applications/wechatwebdevtools.app/Contents/Resources/app.asar.unpacked/node_modules/wcc-exec'
const root = path.resolve(__dirname, '../miniprogram')
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'billiard-templates-'))
const files = fs.readdirSync(root, { recursive: true }).filter((file) => /\.(wxml|wxss)$/.test(file))
function compile(name, sources, destination) {
    const result = execFileSync(path.join(bin, name), ['-o', destination, ...sources], { cwd: root, encoding: 'utf8' })
    assert.equal(result.trim(), '', '编译器报错：' + result)
    assert.ok(fs.statSync(destination).size > 0, '编译产物为空')
}
function nodes(tree) {
    return typeof tree === 'object' && tree ? [tree, ...(tree.children || []).flatMap(nodes)] : []
}

async function main() {
    const wxml = path.join(output, 'wxml.js')
    compile('wcc', files.filter((file) => file.endsWith('.wxml')), wxml)
    for (const file of files.filter((file) => file.endsWith('.wxss'))) {
        compile('wcsc', [file], path.join(output, 'wxss.css'))
    }
    const errors = []
    const context = vm.createContext({ window: {}, console: { log: (error) => errors.push(error), warn: (error) => errors.push(error) } })
    vm.runInContext(fs.readFileSync(wxml, 'utf8'), context)
    function render(file, page) {
        const tree = context.$gwx(file)(page.data)
        assert.deepEqual(errors, [], 'WXML 运行时错误')
        for (const node of nodes(tree)) {
            for (const [key, handler] of Object.entries(node.attr || {})) {
                if (/^(bind|catch)/.test(key) && handler) assert.equal(typeof page[handler], 'function', '未实现事件：' + handler)
            }
        }
        return tree
    }
    const { page } = await scoring()
    const file = 'package-game/pages/snooker-game/snooker-game.wxml'
    let tree = render(file, page)
    let balls = nodes(tree).filter((node) => node.attr?.bindtap === 'handleBall')
    assert.equal(balls.length, 7)
    assert.deepEqual(balls.filter((node) => !node.attr.disabled).map((node) => node.attr['data-key']), ['red'])
    page.applyMatch(match({ current_scores: snapshot({ next_ball: 'colour', reds_remaining: 5, can_undo: true }, 1) }))
    tree = render(file, page)
    balls = nodes(tree).filter((node) => node.attr?.bindtap === 'handleBall')
    assert.equal(balls.filter((node) => !node.attr.disabled).length, 6)
    for (const dialog of ['foul', 'settle', 'concede']) {
        page.handleOpenDialog(event({ dialog }))
        tree = render(file, page)
        assert.ok(nodes(tree).some((node) => node.attr?.bindtap === 'handleConfirm'))
        if (dialog === 'foul') assert.ok(nodes(tree).some((node) => node.attr?.bindchange === 'handleReplayFoul'))
        page.handleCloseDialog()
    }
    page.applyMatch(match({ current_scores: { 1: { score: 0 }, 2: { score: 0 } } }))
    tree = render(file, page)
    assert.equal(nodes(tree).filter((node) => node.attr?.bindtap === 'handleBall' && !node.attr.disabled).length, 7)
    for (const ready of [false, true]) {
        page.setData({ ready, loading: false, error: '测试错误', needsRefresh: true })
        render(file, page)
    }
    const app = harness()
    const room = app.page('package-game/pages/create-room/create-room.ts')
    room.applyMatchToForm(match({ status: 1 }))
    render('package-game/pages/create-room/create-room.wxml', room)
    const detail = app.page('package-record/pages/record-detail/record-detail.ts')
    detail.applyMatchDetail(match({ status: 3 }))
    detail.setData({ isLoading: false })
    render('package-record/pages/record-detail/record-detail.wxml', detail)
    const appConfig = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
    const routes = [...appConfig.pages, ...appConfig.subPackages.flatMap((pack) => pack.pages.map((page) => pack.root + '/' + page))]
    for (const route of routes) {
        for (const extension of ['ts', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(root, route + '.' + extension)))
    }
    console.log(`已编译 ${files.length} 个 WXML/WXSS 文件，验证 ${routes.length} 个页面注册及斯诺克模板状态、事件绑定。`)
}
main().catch((err) => { console.error(err); process.exitCode = 1 }).finally(() => fs.rmSync(output, { recursive: true, force: true }))
