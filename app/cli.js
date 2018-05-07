const readline = require("readline");
const crypto = require("crypto");
const Writable = require('stream').Writable;
const processCommand = require("./cmd.js");

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
                if(!username && !password) {
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
                } else if(username && !password) {
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
                    processCommand(line, rl, mutableStdout, () => {
                        username = undefined;
                        password = undefined;
                        rl.setPrompt("Admin username > ");
                    }, server, mysql);
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