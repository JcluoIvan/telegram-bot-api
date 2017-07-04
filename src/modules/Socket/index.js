const net = require('net');

function jsonParse (str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}

module.exports = class {
    constructor (portOrIO, host = '127.0.0.1') {
        let events = {};
        this.cache = {
            io: null,
            events,

            /* 若斷線時, 是否嘗試重新連線 */
            reconnecting: true,
        };

        this.connect(portOrIO, host);

    }
    get io () { return this.cache.io; }

    get reconnecting () { return this.cache.reconnecting; }

    set reconnecting (bool) { this.cache.reconnecting = Boolean(bool); }

    connect (portOrIO, host) {
        let {events} = this.cache;
        let port = portOrIO;
        let io = portOrIO;
        if (typeof port === 'number') {
            io = net.connect(port, host, function() {
            });
        }
        io.on('connect', () => {
            (events.connect || []).forEach(cb => cb());
        });

        io.on('data', buffer => {
            let data = jsonParse(buffer.toString());
            if (data && Array.isArray(data)) {
                let [name, value] = data;
                (events[name] || []).forEach(cb => cb(value));
            }
        });

        io.on('error', err => {
            (events['error'] || []).forEach(cb => cb(err));
            if (this.reconnecting && (typeof port === 'number')) {
                setTimeout(() => {
                    this.connect(port, host);
                }, 5000);
            }
        });

        io.on('end', () => {
            (events['disconnect'] || []).forEach(cb => cb());
        });

        this.cache.io = io;
    }

    disconnect () {
        this.io.end();
    }

    on (name, cb) {
        let callbacks = this.cache.events[name] || null;
        if (! callbacks) {
            callbacks = [];
            this.cache.events[name] = callbacks;
        }
        callbacks.push(cb.bind(this));
    }
    emit (name, value) {
        this.io.write(JSON.stringify([name, value]));
    }

};
