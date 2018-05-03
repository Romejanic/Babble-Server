const readline = require("readline");
const crypto = require("crypto");
const Writable = require('stream').Writable;

const cli = function(config, server, mysql, shutdownCallback) {
    return {
        start: function() {
            var username, password;

            var mutableStdout = new Writable({
                write: function(chunk, encoding, callback) {
                    if (!this.muted) {
                        process.stdout.write(chunk, encoding);
                    }
                    callback();
                }
            });
            mutableStdout.muted = false;
              
            var rl = readline.createInterface({
                input: process.stdin,
                output: mutableStdout,
                terminal: true
            });
            rl.setPrompt("Admin username > ");
            rl.prompt();

            rl.on("line", (line) => {
                if(!username) {
                    if(!line || line.trim().length <= 0) {
                        console.error("Invalid username!");
                        username = undefined;
                        password = undefined;
                        return;
                    } else {
                        username = line.trim();
                        rl.setPrompt("Admin password > ");
                        rl.prompt();
                        mutableStdout.muted = true;
                    }
                } else if(!password) {
                    mutableStdout.muted = false;
                    console.log();
                    if(!line || line.trim().length <= 0) {
                        console.error("Invalid password!");
                        username = undefined;
                        password = undefined;
                        rl.setPrompt("Admin username > ");
                        return;
                    } else {
                        password = line.trim();
                        var adminSalt = config.adminPassword.substring(0, 16);
                        var adminPassword = config.adminPassword.substring(16);
                        password = crypto.createHmac("sha256", adminSalt).update(adminSalt+password).digest("base64");
                        if(username !== config.adminUsername || password !== adminPassword) {
                            console.error("Invalid login credentials!");
                            username = undefined;
                            password = undefined;
                            rl.setPrompt("Admin username > ");
                        } else {
                            console.log("Welcome, " + username + "!");
                            console.log("Type 'help' for a list of commands.");
                            rl.setPrompt("> ");
                        }
                    }
                } else if(username && password) {
                    var cmd = line.trim();
                    if(cmd.length > 0) {
                        if(cmd.startsWith("shutdown")) {
                            rl.close();
                            mutableStdout.muted = true;
                        } else if(cmd.startsWith("logout")) {
                            console.log("Goodbye, " + username + "!");
                            username = undefined;
                            password = undefined;
                            rl.setPrompt("Admin username > ");
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
                        } else {
                            console.log("Unrecognized command: " + cmd);
                        }
                    }
                } else {
                    console.log("You must be logged in to perform actions.");
                    username = undefined;
                    password = undefined;
                }
                if(!mutableStdout.muted) { rl.prompt(); }
            });
            rl.on("close", shutdownCallback);
        }
    };
};

module.exports = cli;