const TelegramBot = require('node-telegram-bot-api');

const token = '444322366:AAEMUKhyjaZjD8uNCe_hag2h79HSPe6CPO0';

const bot = new TelegramBot(token, {polling: true});


let watchs = [];

// function findUserWatch(id) {
//     return watchs.find(o => o.id === id) || null;
// }


// bot.onText(/\/get (.+)/, (msg, match) => {
//     let [, action] = match;
//     switch (action) {
//         case 'list':


//     }

// });
bot.onText(/\/watch (.+)/, (msg, match) => {
    let id = msg.chat.id;
    let watchName = match[1];
    let user = watchs.find(o => o.id === id);
    if (! user) {
        watchs.push({
            id,
            watch: {

                /* javaserver 服務 */
                javaserver: false,

                /* 234星外補服務 */
                outbetStar234: false,
            }
        });
    }

    switch (watchName) {
        case 'javaserver':

            break;
        default:
            bot.sendMessage(id, `unknown action > ${watchName}`);
            break;
    }
});

bot.onText(/\/help/, (msg, match) => {
    let id = msg.chat.id;
    let message = ([
        '/get list > 取得你的監聽事件',
        '/watch javaserver > 監聽 javaserver 狀態',
        '/help > 列出所有功能'
    ]);

    bot.sendMessage(id, message.join('\n'));
});


bot.onText(/\/echo (.+)/, (msg, match) => {

    const chatId = msg.chat.id;
    const resp = match[1];

    bot.sendMessage(chatId, resp);

});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Received your message');
});

console.info('start');

