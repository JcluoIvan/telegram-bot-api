const net = require('net');
const moment = require('moment');
const Socket = require('./modules/Socket');
const TelegramBot = require('node-telegram-bot-api');
const token = '444322366:AAEMUKhyjaZjD8uNCe_hag2h79HSPe6CPO0';
const execSync = require('child_process').execSync;

const bot = new TelegramBot(token, {polling: true});
let sidAutoincrement = 0;

let app = {
    users: [],
    connects: [],
    offlines: [],

    serviceConnect (io, name) {
        let address = io.remoteAddress;
        let connectAt = moment();

        app.connects.unshift({
            sid: ++ sidAutoincrement,
            io,
            address,
            restartCommand: {cmd: null, cwd: null},
            name,
            connectAt,
        });

        io.on('disconnect', () => app.serviceDisconnect(io));
        io.on('error', err => app.serviceDisconnect(io, err));

        /* 若是監視狀態時, 傳送訊息 */
        let message = `[ ${name} ] connect at ${connectAt.format('HH:mm:ss')}`;
        this.users.filter(u => u.watch).forEach(user => {
            bot.sendMessage(user.id, message);
        });

    },

    serviceDisconnect (io, error = null) {

        let connect = this.connects.find(o => o.io === io);
        let {sid, restartCommand, name, connectAt} = connect;

        let disconnectAt = moment();

        /* 移除連線 */
        this.connects = this.connects.filter(c => c !== connect);

        this.offlines.unshift({
            sid,
            restartCommand,
            name,
            connectAt,
            disconnectAt,
            error
        });

        let message = `[ ${name} ] disconnect at ${disconnectAt.format('HH:mm:ss')}`;
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

    /* 限制必需在 1000 內設定名稱, 不然就切斷 */
    let timer = setTimeout(() => {
        io.emit('error', 'no set name');
        io.disconnect();
    }, 1000);

    /* 設定名稱 */
    io.on('name', value => {
        if (! timer) {
            return;
        }
        app.serviceConnect(io, value);
        clearTimeout(timer);
        timer = null;
    });

    io.on('restart.command', ({cmd, cwd}) => {
        let conn = app.connects.find(o => o.io === io);
        if (conn) {
            conn.restartCommand = {cmd, cwd};
        }
    });

});


server.listen(8800, () => {
    console.log('server start');
});

bot.onText(/\/get (.+)/, (msg, match) => {
    let id = msg.chat.id;

    switch (match[1]) {

        /* 列出所有連線服務 */
        case 'list': {
            let message = ['程序 ID. [程序名稱] at 連線建立時間'];
            app.connects.forEach(o => {
                message.push(`[ ${o.name} ] at ${o.connectAt.format('MM-DD HH:mm:ss')}`);
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

            let message = ['SID. [程序名稱] at 離線建立時間(MM-DD HH:mm:ss)'];
            app.offlines.forEach(o => {
                message.push(`${o.sid}. [${o.name}] at ${o.disconnectAt.format('MM-DD HH:mm:ss')}`);
            });
            if (message.length > 1) {
                message = message.join('\n');
            } else {
                message = '目前無程序在線';
            }
            bot.sendMessage(id, message);
        } break;
        default:
            console.info(`unknown command > ${match[1]}`);
            break;
    }
});

bot.onText(/\/watch/, msg => {
    let id = msg.chat.id;

    /* 啟用監視狀態 */
    app.userWatch(id);
    bot.sendMessage(id, 'watch on');
});

bot.onText(/\/unwatch/, msg => {
    let id = msg.chat.id;
    /* 關閉監視狀態 */
    app.userUnWatch(id);
    bot.sendMessage(id, 'watch off');
});

bot.onText(/\/restart (.+)/, (msg, match) => {

    let id = msg.chat.id;
    let sid = Number(match[0]) || 0;

    let item = app.offlines.find(o => o.sid === sid);
    if (! item) {
        bot.sendMessage(id, `服務名稱 [${name}] 不存在, 請檢查名稱是否有誤`);
        return;
    }

    let {cwd, cmd} = item.restartCommand;
    if (! cmd) {
        bot.sendMessage(id, `服務未設定重啟命令, 無法重啟`);
        return;
    }

    let repeat = app.connects.find(o => (o.name === item.name) || (o.restartCommand.cmd === cmd));
    if (repeat) {
        bot.sendMessage(id, `重啟項目與目前線上服務 [${repeat.name}] 的名稱 or 重啟指令重複, 無法執行指令`);
        return;
    }

    /* 重新啟動服務 */
    try {
        let result = execSync(`nohup ${cmd} &`, {cwd});
        bot.sendMessage(id, `指令執行成功 > ${result}`);
    } catch (err) {
        bot.sendMessage(id, `服務重啟失敗 > ${err.toString()}`);
    }
});

bot.onText(/\/help/, msg => {
    let id = msg.chat.id;
    let message = ([
        '/get list  > 取得所有連線中的服務',
        '/get offline  >  取得離線的服務',
        '/restart {sid}  >  重啟離線的服務',
        '/watch  >  開始關注提醒',
        '/unwatch  >  停止關注',
        '/help  >  列出所有功能'
    ]);
    bot.sendMessage(id, message.join('\n'));

});


