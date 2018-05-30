const net = require("net");
const ip = require("ip");
const Encrypt = require("./encrypt.js");

const server = {
    clients: Array(),
    start: function(config, auth, mysql, callback) {
        this.socketServer = net.createServer((socket) => {
            var client = {
                name: null,
                user_id: null,
                encryption: Encrypt(),
                socket: socket,
                sendPacket: function(packet) {
                    if(!packet.id) {
                        throw "Object is not a packet (requires packet identifier)";
                    }
                    var json = JSON.stringify(packet);
                    var encrypted = this.encryption.encrypt(json);
                    this.socket.write(encrypted);
                }
            };
            this.clients.push(client);
            client.encryption.onAesKeyGenerated = () => {
                client.sendPacket({
                    id: "request_auth"
                });
            };

            socket.setTimeout(60000);
            socket.on("data", (data) => {
                try {
                    if(client.encryption.aesKey) {
                        var packetJson = client.encryption.decrypt(data.toString());
                        var packet;
                        try {
                            packet = JSON.parse(packetJson);
                        } catch(e) {
                            throw "bad packet json: " + packetJson;
                        }
                        if(packet) {
                            this.handlePacket(packet, client);
                        }
                    } else {
                        client.encryption.handleKeyExchangePacket(data, socket);
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
                    if(client.encryption.aesKey) {
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
                if(client.encryption.aesKey) {
                    client.sendPacket(packet);
                    socket.end();
                } else {
                    socket.end(JSON.stringify(packet));
                }
            });
            socket.on("error", (e) => {
                console.error("Error when handling socket!\n", e);
            });
            socket.on("close", () => {
                if(client.user_id && !client.firstLogin) {
                    this.mysql.query("UPDATE users SET lastLogin = ? WHERE id = ?", [Date.now(), client.user_id]);
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
                    if(result.firstLogin) {
                        client.firstLogin = result.firstLogin;
                    } else {
                        var messages = this.mysql.query("SELECT * FROM messages WHERE conversation IN (SELECT conversation FROM conversation_members WHERE userId = ?) AND timestamp >= (SELECT lastLogin FROM users WHERE id = ?)", [client.user_id]);
                        if(messages.length && messages.length > 0) {
                            client.sendPacket({
                                id: "new_messages",
                                payload: messages
                            });
                        }
                        var myConvos = this.mysql.query("SELECT conversation AS id FROM conversation_members WHERE userId = ?", [client.user_id]);
                        if(myConvos.length && myConvos.length > 0) {
                            client.sendPacket({
                                id: "sync_convos",
                                payload: myConvos
                            });
                        }
                    }
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

                // Check if this is the first login
                var firstLogin = this.mysql.query("SELECT lastLogin FROM users WHERE id = ?", [client.user_id]);
                if(!firstLogin[0].lastLogin) {
                    this.mysql.query("UPDATE users SET lastLogin = ? WHERE id = ?", [Date.now(), client.user_id]);
                }

                client.sendPacket({
                    id: "confirm",
                    payload: "User profile updated."
                });
            }
        } else if(packet.id === "bad_request") {
            if(packet.payload === "auth_already_requested") {
                client.sendPacket({
                    id: "login_status",
                    payload: {
                        success: false,
                        error: "No credentials, please try again."
                    }
                });
                client.socket.end();
            }
        } else if(packet.id === "get_users") {
            var users = this.mysql.query("SELECT id, name, image FROM users");
            users.forEach((v) => {
                if(v.id == client.user_id) {
                    v.self = true;
                }
            });
            client.sendPacket({
                id: "user_list",
                payload: users
            });
        } else if(packet.id === "create_conversation") {
            var convo = packet.payload;
            var q = this.mysql.query("INSERT INTO conversations (name, image) VALUES (?, ?)", [convo.name, convo.image]);
            convo.id = q.insertId;
            convo.members.forEach((v) => {
                this.mysql.query("INSERT INTO conversation_members (userId, conversation) VALUES (?, ?)", [v, convo.id]);
                this.clients.forEach((c) => {
                    if(c.user_id == v) {
                        c.sendPacket({
                            id: "new_conversation",
                            payload: convo
                        });
                    }
                });
            });
            client.sendPacket({
                id: "conversation_created",
                payload: {
                    name: convo.name,
                    id: convo.id
                }
            });
        } else if(packet.id === "message") {
            var message = packet.payload;
            var sender  = client.user_id;

            var isMember = this.mysql.query("SELECT userId FROM conversation_members WHERE conversation = ? AND userId = ?", [message.conversation, sender]);
            if(!isMember || !isMember.length || isMember.length <= 0) {
                client.sendPacket({
                    id: "message_status",
                    payload: {
                        success: false,
                        error: "You are not a member of this conversation!"
                    }
                });
                return;
            }

            this.mysql.query("INSERT INTO messages (sender, conversation, type, content, timestamp) VALUES (?, ?, ?, ?, ?)", [sender, message.conversation, message.type, message.content, Date.now()]);

            var otherMembers = this.mysql.query("SELECT userId FROM conversation_members WHERE conversation = ? AND userId != ?", [message.conversation, sender]);
            if(otherMembers && otherMembers.length > 0) {
                message.sender = sender;
                this.clients.forEach((c) => {
                    otherMembers.forEach((v) => {
                        if(c.user_id == v.userId) {
                            c.sendPacket({
                                id: "message",
                                payload: message
                            });
                        }
                    });
                });
            }
        } else if(packet.id === "sync_convos") {
            packet.payload.forEach((id) => {
                var convoInfo = this.mysql.query("SELECT * FROM conversations WHERE id = ?", [id]);
                var members   = this.mysql.query("SELECT userId FROM conversation_members WHERE conversation = ?", [id]);
                var messages  = this.mysql.query("SELECT sender, conversation, type, content FROM messages WHERE conversation = ?", [id]);

                if(!convoInfo.length || convoInfo.length <= 0 || !members.length || members.length <= 0) {
                    return;
                }

                var convo = convoInfo[0];
                convo.members = [];
                members.forEach((v) => {
                    convo.members.push(v.userId);
                });
                convo.chatHistory = [];
                messages.forEach((v) => {
                    convo.chatHistory.push(v);
                });

                client.sendPacket({
                    id: "new_conversation",
                    payload: convo
                });
            });
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