var processCommand = function(line, rl, auth, mutableStdout, logout, server, mysql) {
    var cmd = line.trim();
    if(cmd.length > 0) {
        if(cmd.startsWith("shutdown")) {
            rl.close();
            mutableStdout.muted = true;
        } else if(cmd.startsWith("logout")) {
            console.log("Goodbye, " + username + "!");
            logout();
        } else if(cmd.startsWith("connection_code")) {
            var args = cmd.substring("connection_code ".length).split(" ");
            if(args.length < 2) {
                console.log("Current connection code: " + server.connectionCode);
                console.log("To generate a code: connection_code <host> <port>");
            } else {
                var code = server.generateConnectionCode(args[0], args[1]);
                console.log("Connection code for " + args[0] + ":" + args[1] + " is " + code);
            }
        } else if(cmd.startsWith("list_clients")) {
            console.log("There are currently " + server.clients.length + " clients connected.");
            server.clients.forEach((v, i) => {
                var address = v.socket.remoteAddress + ":" + v.socket.remotePort + "(" + v.socket.remoteFamily + ")";
                console.log("#" + (i+1) + ": " + v.name + " (" + v.user_id + ") " + address); 
            });
        } else if(cmd.startsWith("users")) {
            var args = cmd.substring("users ".length).split(" ");
            if(args.length < 1) {
                console.error("Usage: users --add <username> <display_name>");
                console.error("Usage: users --list");
                console.error("Usage: users --del <username>");
            } else {
                if(args[0] == "--list") {
                    var query = mysql.query("SELECT id, username, name, lastLogin FROM users");
                    if(typeof query === "string") {
                        console.error("ERROR: Failed to query database. Maybe there are no users?");
                    } else {
                        console.log("Found " + query.length + " users.");
                        query.forEach((v) => {
                            console.log("(#" + v.id + ") " + v.name + " (" + v.username + ")");
                        });
                    }
                } else if(args[0] == "--add") {
                    if(args.length < 3) {
                        console.error("Usage: users --add <username> <display_name>");
                    } else {
                        var username = args[1];
                        var displayName = "";
                        for(var i = 2; i < args.length; i++) {
                            displayName += args[i] + " ";
                        }
                        displayName = displayName.trim();
                        var password = auth.hashPassword("password");

                        var userCheck = mysql.query("SELECT name FROM users WHERE username = ?", [ username ]);
                        if(userCheck.length > 0) {
                            console.log("That username (" + username + ") is already taken by " + userCheck[0].name);
                        } else {
                            var query = mysql.query("INSERT INTO users (name, username, password) VALUES (?, ?, ?)", [displayName, username, password]);
                            if(query.insertId) {
                                console.log("Registered user: " + displayName + " (" + username + ")");
                            }
                        }
                    }
                } else if(args[0] == "--del") {
                    if(args.length < 2) {
                        console.error("Usage: users --del <username>");
                    } else {
                        var query = mysql.query("DELETE FROM users WHERE username = ?", [ args[1] ]);
                        if(query.affectedRows == 1) {
                            console.log("Deleted user: " + args[1]);
                        } else if(query.affectedRows < 1) {
                            console.log("No user with username " + args[1] + " found!");
                        }
                    }
                }
            }
        } else if(cmd.startsWith("debug")) {
            var args = cmd.substring("debug ".length).split(" ");
            if(args.length < 4 || args[0] !== "--senddummymessage") {
                console.error("Usage: debug --senddummymessage <sender> <conversation> <content>");
            } else {
                try {
                    var senderID = parseInt(args[1]);
                    var convoID  = parseInt(args[2]);
                    var content  = args[3];

                    var sender = mysql.query("SELECT id FROM users WHERE id = ?", [senderID]);
                    if(!sender.length || sender.length <= 0) {
                        console.error("No user with ID " + senderID + " was found!");
                        return;
                    }
                    var convo = mysql.query("SELECT id FROM conversations WHERE id = ?", [convoID]);
                    if(!convo.length || convo.length <= 0) {
                        console.error("No conversation with ID " + convoID + " was found!");
                        return;
                    }
                    var isMember = mysql.query("SELECT * FROM conversation_members WHERE userId = ? AND conversation = ?", [sender[0].id, convo[0].id]);
                    if(!isMember.length || !isMember.length <= 0) {
                        console.error("Sender ID " + senderID + " is not a member of conversation ID " + convoID);
                        return;
                    }

                    this.mysql.query("INSERT INTO messages (sender, conversation, type, content, timestamp) VALUES (?, ?, ?, ?, ?)", [sender[0].id, convo[0].id, "text", content, Date.now()]);

                    var otherMembers = this.mysql.query("SELECT userId FROM conversation_members WHERE conversation = ? AND userId != ?", [convo[0].id, sender[0].id]);
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

                    console.log("Message sent to conversation ID " + convoID + " and " + otherMembers.length + " members (if online)");
                } catch(e) {
                    console.error("An error occoured executing the command. Make sure you entered valid numbers for the sender and conversation ID.");
                }
            }
        } else {
            console.log("Unrecognized command: " + cmd);
        }
    }
};
module.exports = processCommand;