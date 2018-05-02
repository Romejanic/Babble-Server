const net = require("net");

const server = {
    start: function(callback) {
        this.socketServer = net.createServer((socket) => {
            socket.setNoDelay(true);
            socket.write("pong!");
            socket.on("data", (data) => {
                console.log(data.toString()); 
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
    console.log("Server started on ", server.address());
    callback();
}

module.exports = server;