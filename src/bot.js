const net = require('net');
const moment = require('moment');
const Socket = require('./modules/Socket');
const TelegramBot = require('node-telegram-bot-api');
const token = '444322366:AAEMUKhyjaZjD8uNCe_hag2h79HSPe6CPO0';
const execSync = require('child_process').execSync;

const bot = new TelegramBot(token, {polling: true});
// let sidAutoincrement = 0;

let app = {
    users: [],
    connects: [],
    offlines: [],

    serviceConnect (io, {name, cmd, cwd, pid}) {
        let address = io.remoteAddress;
        let connectAt = moment();
        // let sid = ++ sidAutoincrement;
        app.connects.unshift({
            // sid,
            io,
            address,
            cmd,
            cwd,
            pid,
            name,
            connectAt,
        });

        io.on('disconnect', () => app.serviceDisconnect(io));
        io.on('error', err => app.serviceDisconnect(io, err));

        /* 若是監視狀態時, 傳送訊息 */
        let message = `[${pid}] ${name} connect at ${connectAt.format('HH:mm:ss')}`;
        this.users.filter(u => u.watch).forEach(user => {
            bot.sendMessage(user.id, message);
        });

    },

    serviceDisconnect (io, error = null) {

        let connect = this.connects.find(o => o.io === io);
        let {cmd, cwd, name, connectAt} = connect;

        let disconnectAt = moment();

        /* 移除連線 */
        this.connects = this.connects.filter(c => c !== connect);

        let off = this.offlines.find(o => o.name === name);

        if (! off) {
            off = {
                cmd,
                cwd,
                name,
                pid: 0,
                connectAt: 0,
                disconnectAt: 0,
                records: [],
            };
            this.offlines.push(off);
        }

        off.connectAt = connectAt;
        off.disconnectAt = disconnectAt;
        off.records.push({
            error,
            connectAt,
            disconnectAt,
        });


        let message = `${name} are disconnect at ${disconnectAt.format('HH:mm:ss')}`;
        this.users.filter(u => u.watch).forEach(user => {
            bot.sendMessage(user.id, message);
        });

    },
    userWatch(id) {
        let user = this.users.find(u => u.id === id);
        if (! user) {
            user = {
                id,
                watch: true,
            };
            this.users.push(user);
        }
        user.watch = true;
        return true;
    },
    userUnWatch(id) {
        let user = this.users.find(u => u.id === id);
        if (! user) {
            user = {
                id,
                watch: false,
            };
            this.users.push(user);
        }
        user.watch = false;
        return true;
    },
};

const server = new net.createServer(client => {
    let io = new Socket(client);

    let IPAddress = client.address().address;
    if (IPAddress !== '::ffff:127.0.0.1') {
        io.emit('error', `Not Allowed From IP Address - ${IPAddress}`);
        io.disconnect();
        return;
    }

    /* 斷線後不嘗試重新連線 */
    io.reconnecting = false;

    /* 限制必需在 1秒 內設定名稱, 不然就切斷 */
    let timer = setTimeout(() => {
        io.emit('error', 'no set name');
        io.disconnect();
        timer = null;
    }, 1000);

    /* 程序註冊 */
    io.on('register', data => {
        app.serviceConnect(io, data);
        clearTimeout(timer);
        timer = null;
    });

});


server.listen(8800, () => {
    console.log('server start');
});

bot.onText(/\/(\w+)$/, (msg, match) => {
    let id = msg.chat.id;

    switch (match[1]) {

        /* 列出所有連線服務 */
        case 'online': {
            let message = ['[PID] 程序名稱 at 連線建立時間'];
            app.connects.forEach(o => {
                message.push(`[${o.pid}] ${o.name} at ${o.connectAt.format('MM-DD HH:mm:ss')}`);
            });
            if (message.length > 1) {
                message = message.join('\n');
            } else {
                message = '目前無程序在線';
            }
            bot.sendMessage(id, message);
        } break;

        /* 列出所有離線的服務 */
        case 'offline': {

            let message = ['程序名稱 at 離線建立時間(MM-DD HH:mm:ss)'];
            app.offlines.forEach(o => {
                message.push(`${o.name} at ${o.disconnectAt.format('MM-DD HH:mm:ss')}`);
            });
            if (message.length > 1) {
                message = message.join('\n');
            } else {
                message = '目前無程序離線';
            }
            bot.sendMessage(id, message);
        } break;

        /* 啟用監視狀態 */
        case 'watch':
            app.userWatch(id);
            bot.sendMessage(id, 'watch on');
            break;

        /* 關閉監視狀態 */
        case 'unwatch':
            app.userUnWatch(id);
            bot.sendMessage(id, 'watch off');
            break;

        case 'help':

            bot.sendMessage(id, ([
                '/online  > 取得所有連線中的服務',
                '/offline  >  取得離線的服務',
                '/restart {name}  >  重啟離線的服務',
                '/delete {name} > 停止服務',
                '/watch  >  開始關注提醒',
                '/unwatch  >  停止關注',
                '/help  >  列出所有功能'
            ]).join('\n'));

            break;

        default:
            console.info(`unknown command > ${match[1]}`);
            break;
    }
});

bot.onText(/\/(re|restart) (.+)/, (msg, match) => {

    let id = msg.chat.id;
    let name = match[2] || null;

    if (! name) {
        bot.sendMessage(id, `請輸入程序名稱`);
    }

    let item = app.connects.find(o => o.name === name) || app.offlines.find(o => o.name === name);
    if (! item) {
        bot.sendMessage(id, `服務 ${name} 不存在, 請檢查名稱是否有誤`);
        return;
    }

    if (! item.cmd) {
        bot.sendMessage(id, `服務未設定重啟命令, 無法重啟`);
        return;
    }

    if (item.pid) {
        try {
            execSync(`kill ${item.pid}`);
        } catch (err) {
            bot.sendMessage(id, `服務重啟失敗 (無法停止程序 pid ${item.pid}) > ${err.toString()}`);
        }
    }

    // let repeat = app.connects.find(o => (o.name === item.name) || (o.cmd === cmd));
    // if (repeat) {
    //     console.info(repeat.pid);
    //     bot.sendMessage(id, `重啟項目與目前線上服務 [${repeat.name}] 的名稱 or 重啟指令重複, 無法執行指令`);
    //     return;
    // }

    /* 建立 log 時間名稱 */
    const timeTag = moment().format('YYMMDD-HHss');
    try {
        const outName = `${item.name}.${timeTag}.out`;
        /* 重新啟動服務 */
        let result = execSync(`nohup ${item.cmd}&>${outName}&`, {cwd: item.cwd});
        bot.sendMessage(id, `指令 [ ${item.cwd}/${item.cmd} | out=${item.cwd}/${outName} ] 執行成功 > ${result.toString()}`);
    } catch (err) {
        bot.sendMessage(id, `服務重啟失敗 (啟動執行執行失敗)> ${err.toString()}`);
    }
});

bot.onText(/\/(del|delete) (.+)/, (msg, match) => {

    let id = msg.chat.id;
    let name = match[2] || null;

    if (! name) {
        bot.sendMessage(id, `請輸入程序名稱`);
    }

    let item = app.connects.find(o => o.name === name) || app.offlines.find(o => o.name === name);
    if (! item) {
        bot.sendMessage(id, `服務 ${name} 不存在, 請檢查名稱是否有誤`);
        return;
    }

    if (item.pid) {
        try {
            execSync(`kill ${item.pid}`);
        } catch (err) {
            bot.sendMessage(id, `服務停止失敗 (無法停止程序 pid ${item.pid}) > ${err.toString()}`);
        }
    }

});
