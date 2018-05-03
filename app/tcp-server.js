const net = require("net");

const server = {
    clients: Array(),
    start: function(config, rsa, callback) {
        this.socketServer = net.createServer((socket) => {
            var client = {
                name: null,
                user_id: null,
                public_key: null,
                socket: socket
            };
            this.clients.push(client);
            rsa.sendKeyExchangePacket(socket);

            socket.on("data", (data) => {
                try {
                    var packet = JSON.parse(data.toString());
                    if(packet) {
                        if(packet.id == "rsa_public_key" && typeof packet.payload === "string") {
                            client.public_key = packet.payload;
                        } else {
                            throw "Packet must be an rsa_public_key with string payload.";
                            socket.close();
                        }
                    }
                } catch(e) {
                    var error = {
                        id: "bad_packet_error",
                        payload: e
                    };
                    socket.write(JSON.stringify(error));
                }
            });
            socket.on("error", (e) => {
                console.error("Error when handling socket!\n", e);
            });
            socket.on("close", () => {
                this.clients.splice(this.clients.indexOf(client), 1);
            });
        });
        this.socketServer.on("error", (e) => {
            if(e.code == "EADDRINUSE") {
                console.error("Server address already in use, finding new port...");
                setTimeout(() => {
                    this.socketServer.close();
                    this.socketServer.listen(config.serverPort, () => { serverListenCallback(this.socketServer, callback); });
                }, 1000);
            } else {
                console.error("Error when handling socket!\n", e);
            }
        });
        this.socketServer.listen(config.serverPort, () => {
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