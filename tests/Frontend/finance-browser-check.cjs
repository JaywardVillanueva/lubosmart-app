const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const net = require('node:net');

const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'storage/app/finance-ui-check');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'lubosmart-auth-browser-'));
const database = path.join(stage, 'test.sqlite');
fs.writeFileSync(database, '');
fs.mkdirSync(output, { recursive: true });
const env = {
    ...process.env,
    APP_ENV: 'testing',
    APP_DEBUG: 'true',
    APP_CONFIG_CACHE: path.join(stage, 'config.php'),
    APP_KEY: 'base64:' + Buffer.alloc(32, 7).toString('base64'),
    DB_URL: '',
    DB_CONNECTION: 'sqlite',
    DB_DATABASE: database,
    MAIL_MAILER: 'array',
    MAIL_SECURITY_MAILER: 'array',
    QUEUE_CONNECTION: 'sync',
    CACHE_STORE: 'database',
    SESSION_DRIVER: 'database',
    SESSION_CONNECTION: 'sqlite',
    DB_CACHE_CONNECTION: 'sqlite',
    DB_CACHE_LOCK_CONNECTION: 'sqlite',
    SESSION_SECURE_COOKIE: 'false',
    LUBOSMART_AUTH_BROWSER_STAGE: stage,
};
const checks = [];
const processes = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function port() {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const value = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    return value;
}
async function until(predicate, label) {
    for (let i = 0; i < 150; i++) {
        if (await predicate()) return;
        await delay(100);
    }
    throw Error('Timed out: ' + label);
}

(async () => {
    let socket;
    let inspect;
    const runtimeErrors = [];
    try {
        const migrate = spawnSync('php', ['artisan', 'migrate', '--force'], { cwd: root, env, encoding: 'utf8', windowsHide: true });
        assert.equal(migrate.status, 0, migrate.stdout + migrate.stderr);
        const seed = spawnSync('php', ['tests/Fixtures/auth-browser-router.php', 'dashboard-seed'], {
            cwd: root,
            env,
            encoding: 'utf8',
            windowsHide: true,
        });
        assert.equal(seed.status, 0, seed.stderr);
        assert.ok(seed.stdout.trim().startsWith('{'), seed.stdout);
        assert.deepEqual(JSON.parse(seed.stdout), { orders: 1, parcels: 1 });
        const inboxSeed = spawnSync('php', ['tests/Fixtures/finance-browser-seed.php'], { cwd: root, env, encoding: 'utf8', windowsHide: true });
        assert.equal(inboxSeed.status, 0, inboxSeed.stdout + inboxSeed.stderr);
        const appPort = await port(),
            debugPort = await port();
        env.APP_URL = 'http://127.0.0.1:' + appPort;
        processes.push(
            spawn('php', ['-S', '127.0.0.1:' + appPort, '-t', 'public', 'tests/Fixtures/auth-browser-router.php'], {
                cwd: root,
                env,
                stdio: 'ignore',
                windowsHide: true,
            }),
        );
        const browser = [
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        ].find((file) => fs.existsSync(file));
        assert.ok(browser, 'Chrome or Edge required');
        processes.push(
            spawn(
                browser,
                [
                    '--headless=new',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--no-sandbox',
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--disable-background-networking',
                    '--remote-debugging-port=' + debugPort,
                    '--user-data-dir=' + path.join(stage, 'browser-profile'),
                    'about:blank',
                ],
                { stdio: 'ignore', windowsHide: true },
            ),
        );
        let tabs;
        await until(async () => {
            try {
                tabs = await (await fetch('http://127.0.0.1:' + debugPort + '/json/list', { signal: AbortSignal.timeout(1000) })).json();
                return tabs.some((t) => t.type === 'page');
            } catch {
                return false;
            }
        }, 'browser start');
        console.log('Headless browser ready');
        socket = new WebSocket(tabs.find((t) => t.type === 'page').webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(Error('Browser WebSocket connection timed out')), 10000);
            socket.onopen = () => {
                clearTimeout(timeout);
                resolve();
            };
            socket.onerror = reject;
        });
        let counter = 0;
        const pending = new Map();
        const errors = runtimeErrors;
        const consoleErrors = [];
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.id) {
                const entry = pending.get(message.id);
                if (entry) {
                    pending.delete(message.id);
                    if (message.error) entry.reject(Error(message.error.message));
                    else entry.resolve(message.result);
                }
            } else if (message.method === 'Network.responseReceived' && message.params.response.status >= 400) {
                console.log('HTTP ' + message.params.response.status + ' ' + new URL(message.params.response.url).pathname);
            } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push('console.error');
            else if (message.method === 'Runtime.exceptionThrown')
                errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description ?? ''));
        };
        const cdp = (method, params = {}) =>
            new Promise((resolve, reject) => {
                const id = ++counter;
                const timeout = setTimeout(() => {
                    pending.delete(id);
                    reject(Error('Browser command timed out: ' + method));
                }, 15000);
                pending.set(id, {
                    resolve: (result) => {
                        clearTimeout(timeout);
                        resolve(result);
                    },
                    reject: (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    },
                });
                socket.send(JSON.stringify({ id, method, params }));
            });
        await cdp('Page.enable');
        await cdp('Runtime.enable');
        await cdp('Network.enable');
        const evaluate = async (expression) => {
            const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
            if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
            return result.result.value;
        };
        inspect = evaluate;
        const navigate = async (route) => {
            await cdp('Page.navigate', { url: env.APP_URL + route });
            await until(
                () =>
                    evaluate(
                        'location.pathname + location.search === ' +
                            JSON.stringify(route) +
                            ' && !!document.querySelector("#app") && !!document.querySelector("h1")',
                    ),
                'render ' + route,
            );
            await delay(250);
        };
        const viewport = async (width, height) =>
            cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
        const screenshot = async (name) => {
            const data = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
            fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(data.data, 'base64'));
        };
        const record = (name, details) => {
            checks.push({ name, status: 'PASS', details });
            console.log('PASS: ' + name);
        };
        const click = async (selector) => {
            const point = await evaluate(
                `(() => { const element=document.querySelector(${JSON.stringify(selector)}); element.scrollIntoView({block:'center'}); const rect=element.getBoundingClientRect(); return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}; })()`,
            );
            await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
            await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
        };
        const set = async (selector, value) => {
            await until(() => evaluate('!!document.querySelector(' + JSON.stringify(selector) + ')'), 'field ' + selector);
            return evaluate(
                `(() => { const el=document.querySelector(${JSON.stringify(selector)}); const setter=Object.getOwnPropertyDescriptor(el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.focus();el.blur(); })()`,
            );
        };
        for (const role of ['admin', 'logistics', 'seller', 'rider']) {
            await cdp('Network.clearBrowserCookies');
            await viewport(1440, 1000);
            await navigate('/login');
            await set('#login-email', role + '@dashboard.example.com');
            await set('#login-password', 'Browser@2026');
            await click('button[type=submit]');
            await until(() => evaluate('location.pathname.startsWith("/dashboard")'), 'login ' + role);
            await navigate('/finance');
            assert.equal(await evaluate('document.querySelectorAll("h1").length'), 1);
            for (const width of [320, 768, 1440]) {
                await viewport(width, 1000);
                await delay(150);
                assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, role + ' overflow ' + width);
                await screenshot(role + '-finance-' + width);
            }
            await evaluate('document.documentElement.classList.add("dark")');
            await screenshot(role + '-finance-dark');
            if (role === 'admin') {
                await navigate('/logistics-settlements');
                await evaluate('Array.from(document.querySelectorAll("main button")).find(b=>b.textContent.includes("Confirm product remittance receipt")).click()');
                await until(() => evaluate('!!document.querySelector("[role=dialog]")'), 'receipt dialog');
                await viewport(320, 1000);
                await screenshot('admin-remittance-dialog-320');
                const field = async (label, value) => {
                    const selector = await evaluate(`(() => {const label=Array.from(document.querySelectorAll('[role=dialog] label')).find(l=>l.textContent.includes(${JSON.stringify(label)})); return '#'+CSS.escape(label.htmlFor);})()`);
                    return set(selector, value);
                };
                await field('Unique receipt reference', 'BROWSER-ACTUAL-PRODUCT-RECEIPT');
                await field('Actual receipt date', '2026-11-11');
                await evaluate(`(() => {const el=document.querySelector('[role=dialog] textarea');const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(el,'Synthetic actual cash receipt evidence.');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
                await evaluate('document.querySelector("[role=dialog] form").requestSubmit()');
                await until(() => evaluate('!document.querySelector("[role=dialog]") && document.querySelector("main").innerText.includes("BROWSER-ACTUAL-PRODUCT-RECEIPT")'), 'recorded product remittance');
                await screenshot('admin-remittance-recorded');
                await navigate('/settlements');
                assert.equal(await evaluate('document.querySelector("main").innerText.includes("Eligible for a recorded manual payout")'), true);
            }
            if (role === 'seller') {
                await navigate('/orders');
                assert.equal(await evaluate('document.querySelector("main").innerText.includes("09171234567")'), false);
                await navigate('/seller/vouchers');
                assert.equal(await evaluate('document.querySelector("main").innerText.includes("Voucher usage history")'), true);
            }
            record('Finance ' + role, 'Real rendered page at 320/768/1440px, dark screenshot, role scoping; Admin remittance form and Seller privacy/history checks');
        }
        assert.deepEqual(runtimeErrors, []);
        record('Finance browser exceptions', 'Zero uncaught exceptions');
    } catch (error) {
        checks.push({ name: 'Browser run', status: 'FAIL', details: error.message });
        console.error(error.stack ?? error.message);
        if (inspect) {
            try {
                console.error(
                    await inspect(
                        'JSON.stringify({title:document.title,body:document.body.innerText.slice(0,160),errors:Array.from(document.querySelectorAll("[role=alert]")).map(el=>el.textContent),fields:Array.from(document.querySelectorAll("input")).filter(el=>el.name&&!el.name.includes("password")).map(el=>({name:el.name,value:el.value,checked:el.checked})),scripts:Array.from(document.scripts).map(s=>s.src)})',
                    ),
                );
                console.error(JSON.stringify(runtimeErrors));
            } catch {
                /* Preserve the original failure if diagnostics are unavailable. */
            }
        }
        process.exitCode = 1;
    } finally {
        fs.writeFileSync(
            path.join(output, 'results.json'),
            JSON.stringify({ date: '2026-11-11', isolation: 'temporary SQLite, synthetic financial records, fake notifications and PSGC', checks }, null, 2),
        );
        if (socket) socket.close();
        for (const process of processes.reverse()) process.kill();
        // Keep disposable profile/database for diagnosis; no customer data used.
    }
})();
