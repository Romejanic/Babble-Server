const crypto = require("crypto");

const auth = function(mysql) {
    return {
        hashPassword: function(password) {
            var salt = Array(17).join((Math.random().toString(36)+'00000000000000000').slice(2, 18)).slice(0, 16);
            return salt + crypto.createHmac("sha256", salt).update(salt+password).digest("base64");
        },
        confirmHashed: function(password, hash) {
            var salt = hash.substring(0, 16);
            var pwHash = hash.substring(16);
            password = crypto.createHmac("sha256", salt).update(salt+password).digest("base64");
            return password === pwHash;
        },

        registerUser: function(displayName, username, password) {
            var passwordHash = this.hashPassword(password);
            return mysql.query("INSERT INTO users (name, username, password) VALUES (?, ?, ?)", [ displayName, username, passwordHash ]);
        },
        checkLogin: function(username, password) {
            var query = mysql.query("SELECT id, name, password FROM users WHERE username = ?", [ username ]);
            if(query.length == 1) {
                var userData = query[0];
                if(this.confirmHashed(password, userData.password)) {
                    return {
                        id: userData.id,
                        name: userData.name
                    };
                } else {
                    return false;
                }
            } else {
                console.error("Failed to authenticate user: " + username);
                return false;
            }
        }
    };
};

module.exports = auth;