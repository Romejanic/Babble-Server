const fs = require("fs");
const crypto = require("crypto");
const readLine = require("readline-sync");
const mysql = require("./mysql.js");
const auth = require("./authentication.js")(mysql);

var config;
try {
    if(fs.existsSync("./config.json")) {
        config = JSON.parse(fs.readFileSync("./config.json").toString());
    }
} catch(e) {
    console.error("Failed to read config file!\n" + e);
}

console.log("== Welcome to Babble server! ==");

if(!config) {
    console.log("Please complete the following steps to configure the server for use with the Babble client.");

    config = {};
    while(!(config.companyName = readLine.question("Please enter your company name > "))) {
        console.log("No company name entered!");
    }
    config.concurrentConnections = readLine.questionInt("How many concurrent connections to the server are allowed? (Default 500) > ") || 500;
    config.loggingPeriod = readLine.questionInt("How long are messages logs kept? (days, Default 30) > ") || 30;
    config.maxGroupName = readLine.questionInt("How long are group chat names allowed to be? (Default 25) > ") || 25;
    config.serverPort = readLine.questionInt("What port will the server use? (Default 55202) > ") || 55202;
    console.log("== Configuration complete! ==");

    while(!config.adminUsername || config.adminUsername.trim().length <= 0) {
        config.adminUsername = readLine.question("Please choose an admin username > ");
    }
    config.adminPassword = readLine.question("Please enter an admin password > ", { hideEchoBack: true });
    while(readLine.question("Please confirm your admin password > ", { hideEchoBack: true }) !== config.adminPassword) {
        console.log("Err: Passwords do not match!");
    }
    config.adminPassword = auth.hashPassword(config.adminPassword);

    console.log("== MySQL Setup ==");
    console.log("The Babble server requires MySQL to store user and message information.");
    console.log("In order to set up the server, please make sure you have a MySQL server set up and running which you have admin access to.");
    
    config.db = {};
    while(!config.db.host || config.db.host.trim().length <= 0) {
        config.db.host = readLine.question("Please enter your MySQL hostname > ");
    }
    while(!config.db.user || config.db.user.trim().length <= 0) {
        config.db.user = readLine.question("Please enter your MySQL username > ");
    }
    config.db.password = readLine.question("Please enter your MySQL password > ", { hideEchoBack: true });
    while(readLine.question("Please confirm your MySQL password > ", { hideEchoBack: true }) !== config.db.password) {
        console.log("Err: Passwords do not match!");
    }

    console.log();
    console.log("That's all for now! Please wait while initial setup is performed...");
    console.log();

    console.log("== Saving config data... ==");
    fs.writeFileSync("./config.json", JSON.stringify(config));

    console.log("== Initializing MySQL database... ==");
    mysql.connect(config.db);
    mysql.performInitialization();
} else {
    console.log("== Connecting to MySQL... ==");
    mysql.connect(config.db);
    mysql.query("USE babble");
}

const rsa = require("./rsa.js").generateKeypair();

console.log("== Starting server... ==");
const babbleServer = require("./tcp-server.js");
const cli = require("./cli.js")(config, babbleServer, mysql, auth, () => {
    console.log("Shutting down server...");
    babbleServer.stop();
    mysql.disconnect();

    console.log("== Shut down server! ==");
    console.log("If the program hangs, you may now safely close it with Ctrl-C.");
});
babbleServer.start(config, rsa, auth, cli.start);