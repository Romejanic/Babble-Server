const net = require("net");

const server = {
    clients: Array(),
    start: function(callback) {
        this.socketServer = net.createServer((socket) => {
            socket.on("data", (data) => {
                socket.write(data.toString().split("").reverse().join(""));
            });
            socket.on("error", (e) => {
                console.error("Error when handling socket!\n", e);
            });
        });
        this.socketServer.on("error", (e) => {
            if(e.code == "EADDRINUSE") {
                console.error("Server address already in use, finding new port...");
                setTimeout(() => {
                    this.socketServer.close();
                    this.socketServer.listen(() => { serverListenCallback(this.socketServer, callback); });
                }, 1000);
            } else {
                console.error("Error when handling socket!\n", e);
            }
        });
        this.socketServer.listen(() => {
            serverListenCallback(this.socketServer, callback);
        });
    },
    stop: function() {
        this.socketServer.close();
    }
};

function serverListenCallback(server, callback) {
    var port = server.address().port;
    console.log("Server started on localhost:" + port);
    callback(port);
}

module.exports = server;