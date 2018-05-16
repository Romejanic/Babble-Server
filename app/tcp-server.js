const net = require("net");
const ip = require("ip");

const server = {
    clients: Array(),
    start: function(config, rsa, auth, mysql, callback) {
        this.socketServer = net.createServer((socket) => {
            var client = {
                name: null,
                user_id: null,
                public_key: null,
                socket: socket,
                sendPacket: function(packet) {
                    if(!packet.id) {
                        throw "Object is not a packet (requires packet identifier)";
                    }
                    var json = JSON.stringify(packet);
                    // var encrypted = rsa.encryptVerified(json, this.public_key); // disabled temporarily
                    var encrypted = rsa.encrypt(json, this.public_key);
                    this.socket.write(encrypted);
                }
            };
            this.clients.push(client);
            rsa.sendKeyExchangePacket(socket);

            socket.setTimeout(10000);
            socket.on("data", (data) => {
                try {
                    var packetJson;
                    if(client.public_key) {
                        // packetJson = rsa.decryptVerified(data, client.public_key);
                        packetJson = rsa.decrypt(data, rsa.rsaKeys.private);
                    } else {
                        packetJson = data.toString();
                    }
                    var packet = JSON.parse(packetJson);
                    if(packet) {
                        if(!client.public_key) {
                            if(packet.id == "rsa_public_key" && typeof packet.payload === "string") {
                                client.public_key = packet.payload;
                                client.sendPacket({
                                    id: "request_auth"
                                });
                            } else {
                                throw "Packet must be an rsa_public_key with string payload.";
                                socket.close();
                            }
                        } else {
                            this.handlePacket(packet, client);
                        }
                    }
                } catch(e) {
                    var error = {
                        id: "bad_format_error"
                    };
                    if(e) {
                        error.payload = e;
                    }
                    if(typeof e == "object") {
                        console.error("error in packet parser", e);
                    }
                    if(client.public_key) {
                        client.sendPacket(error);
                    } else {
                        socket.write(JSON.stringify(error));
                    }
                }
            });
            socket.on("timeout", () => {
                var packet = {
                    id: "timeout"
                };
                if(client.public_key) {
                    client.sendPacket(packet);
                    socket.end();
                } else {
                    socket.end(JSON.stringify(packet));
                }
                console.log("timeout");
            });
            socket.on("error", (e) => {
                console.error("Error when handling socket!\n", e);
            });
            socket.on("close", () => {
                if(client.user_id) {
                    // send last login to db
                }
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

        this.auth = auth;
        this.mysql = mysql;
    },
    stop: function() {
        this.socketServer.close();
        this.clients.forEach((client) => {
            client.socket.end();
        });
        console.log("Disconnected", this.clients.length, "active clients.");
        this.clients.splice(0, this.clients.length);
    },

    handlePacket: function(packet, client) {
        if(packet.id == "authenticate") {
            if(!packet.payload || !packet.payload.username || !packet.payload.password) {
                client.sendPacket({
                    id: "incomplete_packet",
                    payload: "Authentication packets require a username and password in the payload"
                });
            } else {
                var result = this.auth.checkLogin(packet.payload.username, packet.payload.password);
                if(typeof result === "object") {
                    client.sendPacket({
                        id: "login_status",
                        payload: {
                            success: true,
                            userId: result
                        }
                    });
                    client.socket.setTimeout(0);
                    client.socket.setKeepAlive(true);

                    client.user_id = result.id;
                    client.name = result.name;
                } else {
                    client.sendPacket({
                        id: "login_status",
                        payload: {
                            success: false,
                            error: "Incorrect login"
                        }
                    });
                    client.socket.end();
                }
            }
        } else if(packet.id === "update_details") {
            if(!packet.payload || typeof packet.payload !== "object") {
                client.sendPacket({
                    id: "bad_format_error",
                    payload: "Payload must be object"
                });
            } else {
                var profileChanges = packet.payload;
                if(profileChanges.name) {
                    this.mysql.query("UPDATE users SET name = ? WHERE id = ?", [profileChanges.name, client.user_id]);
                }
                if(profileChanges.password) {
                    var pwHash = this.auth.hashPassword(profileChanges.password);
                    this.mysql.query("UPDATE users SET password = ? WHERE id = ?", [pwHash, client.user_id]);
                }
                if(profileChanges.profilePic) {
                    this.mysql.query("UPDATE users SET image = ? WHERE id = ?", [profileChanges.profilePic, client.user_id]);
                }

                // Check if this is first login
                var firstLogin = this.mysql.query("SELECT lastLogin FROM users WHERE id = ?", [client.user_id]);
                if(!firstLogin[0].lastLogin) {
                    this.mysql.query("UPDATE users SET lastLogin = ? WHERE id = ?", [Date.now(), client.user_id]);
                }

                client.sendPacket({
                    id: "confirm",
                    payload: "User profile updated."
                });
            }
        } else {
            client.sendPacket({
                id: "unrecognised_packet",
                payload: packet ? packet.id : undefined
            });
        }
    },

    generateConnectionCode: function(host, port) {
        var socketAddr = host + ":" + port;
        return new Buffer(socketAddr).toString("base64");
    }
};

function serverListenCallback(socket, callback) {
    var host = ip.address();
    var port = socket.address().port;
    server.connectionCode = server.generateConnectionCode(host, port);

    console.log("== Server started! Clients may connect with " + server.connectionCode + " ==");
    console.log("In order to use another host address, you can generate a new connection code with the command connection_code.");
    callback(port);
}

module.exports = server;