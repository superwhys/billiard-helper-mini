const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const event = (dataset = {}, value = '') => ({ currentTarget: { dataset }, detail: { value } })

function harness() {
    const root = path.resolve(__dirname, '../miniprogram')
    const cache = new Map()
    const storage = new Map()
    const requests = []
    const navigations = []
    const loadingEvents = []
    let definition
    let networkListener
    const runtime = {
        requests, navigations, storage, loadingEvents,
        loadingTitle: '',
        respond: () => { throw new Error('Unexpected request') },
        network(isConnected) { networkListener?.({ isConnected }) },
        hasNetworkListener: () => !!networkListener,
    }
    const wx = {
        getStorageSync: (key) => clone(storage.get(key)),
        setStorageSync: (key, value) => storage.set(key, clone(value)),
        removeStorageSync: (key) => storage.delete(key),
        getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }),
        getNetworkType: ({ success }) => success({ networkType: 'wifi' }),
        onNetworkStatusChange: (listener) => { networkListener = listener },
        offNetworkStatusChange: (listener) => { if (listener === networkListener) networkListener = null },
        showToast() {},
        showLoading(options) {
            runtime.loadingTitle = options.title
            loadingEvents.push({ action: 'show', title: options.title })
        },
        hideLoading() {
            runtime.loadingTitle = ''
            loadingEvents.push({ action: 'hide' })
        },
        navigateTo: (data) => navigations.push(data.url),
        redirectTo: (data) => navigations.push(data.url),
        navigateBack() {},
        request(options) {
            const request = { path: new URL(options.url).pathname.replace('/api', ''), data: clone(options.data), method: options.method }
            requests.push(request)
            Promise.resolve().then(() => runtime.respond(request)).then((data) => {
                options.success({ statusCode: 200, data: { code: 0, data: clone(data) } })
            }, (err) => {
                options.success({ statusCode: 200, data: { code: 1, message: err.message } })
            }).finally(() => options.complete?.())
        },
    }
    const context = vm.createContext({
        console, setTimeout, clearTimeout, wx,
        Page: (options) => { definition = options },
        getApp: () => ({ globalData: { navBarHeight: 44 } }),
    })
    function load(relative) {
        const filename = path.resolve(root, relative)
        if (cache.has(filename)) return cache.get(filename).exports
        const module = { exports: {} }
        cache.set(filename, module)
        const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
            compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
        }).outputText
        const requireLocal = (name) => load(path.resolve(path.dirname(filename), name + '.ts'))
        vm.runInContext(`(function(require, module, exports) {${js}\n})`, context, { filename })(requireLocal, module, module.exports)
        return module.exports
    }
    load('utils/login-ready.ts').markLoginReady()
    runtime.load = load
    runtime.page = (relative) => {
        load(relative)
        return { ...definition, data: clone(definition.data), setData(value) { Object.assign(this.data, clone(value)) } }
    }
    return runtime
}

function snapshot(overrides = {}, first = 0, second = 0) {
    return {
        1: { score: first, extra: {} }, 2: { score: second, extra: {} },
        _snooker: { red_count: 6, reds_remaining: 6, next_ball: 'red', active_player_id: 1,
            break_score: 0, remaining_points: 75, can_undo: false, ...overrides },
    }
}

function match(overrides = {}) {
    return {
        id: 13, owner_id: 7, name: '斯诺克练习赛', match_type: 'snooker', status: 2, match_round: 1,
        created_at: '2026-09-22T09:00:00+08:00', config: { max_players: 2, target_score: 3, data: { red_count: 6 } },
        players: [{ id: 1, nick_name: '阿文', code: 'a' }, { id: 2, nick_name: '小林', code: 'b' }],
        current_scores: snapshot(), match_games: [], ...overrides,
    }
}

async function scoring(value = match()) {
    const app = harness()
    app.respond = ({ path }) => { if (path === '/match/detail') return value; throw new Error('Unexpected request: ' + path) }
    const page = app.page('package-game/pages/snooker-game/snooker-game.ts')
    page.onLoad({ matchId: '13' })
    await page.loadMatch()
    return { app, page }
}
module.exports = { harness, snapshot, match, scoring, event, clone }
