
const Socket = require('./modules/Socket');


let io = new Socket(8800);

io.reconnecting = false;

io.on('error', err => {
    console.info(err);
});

io.on('connect', () => {

    io.emit('name', 'Hello');

});



// const net = require('net');


// let io = net.connect(8800, () => {


//     /* 設定服務名稱 (必需在 1s 內設定, 否則會被切斷) */
//     let nameData = ['name', 'demo'];
//     io.write(JSON.stringify(nameData));
// });


// io.on('data', buffer => {
//     console.info(buffer.toString());
// });



