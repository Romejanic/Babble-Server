const net = require("net");

const server = {
    start: function(callback) {
        this.socketServer = net.createServer((socket) => {
            socket.write("pong!");
        });
        this.socketServer.on("error", (e) => {
            if(e.code == "EADDRINUSE") {
                console.error("Server address already in use, finding new port...");
                setTimeout(() => {
                    this.socketServer.close();
                    this.socketServer.listen(() => { serverListenCallback(this.socketServer, callback); });
                }, 1000);
            }
        });
        this.socketServer.listen(() => {
            serverListenCallback(this.socketServer, callback);
        });
    }
};

function serverListenCallback(server, callback) {
    console.log("Server started on ", server.address());
    callback();
}

module.exports = server;