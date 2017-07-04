const net = require('net');
const moment = require('moment');

let connects = [];
let log = {
    offlines: [],
};
let app = {

    onClientOffLine (io, error = null) {
        let connect = connects.find(o => o.io === io);
        let {name, connectAt} = connect;
        let disconnectAt = new Date();
        connects = connects.filter(c => c !== connect);
        log.offlines.push({
            name,
            connectAt,
            disconnectAt,
            error
        });

    }

};

const server = new net.createServer(function(io) {
    let address = io.remoteAddress;
    let connectAt = moment();
    connects.push({
        io,
        address,
        name: `no name > ${address} at ${connectAt.format('YYYY/MM/DD HH:mm:ss')}`,
        connectAt,
    });

    io.on('end', () => {
        app.onClientOffLine(io);
    });


    io.on('data', data => {
        console.log(`data > ${data}`);
    });

    io.on('error', err => {
        app.onClientOffLine(io, err);
    });

});

server.listen(8800, () => {
    console.log('server start');
});

