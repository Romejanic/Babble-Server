const crypto = require("crypto");

const auth = function(mysql) {
    return {
        hashPassword: function(password) {
            var salt = crypto.randomBytes(17).toString("base64").slice(0, 24);
            return salt + crypto.createHmac("sha256", salt).update(salt+password).digest("base64");
        },
        confirmHashed: function(password, hash) {
            var salt = hash.substring(0, 24);
            var pwHash = hash.substring(24);
            password = crypto.createHmac("sha256", salt).update(salt+password).digest("base64");
            return password === pwHash;
        },

        registerUser: function(displayName, username, password) {
            var passwordHash = this.hashPassword(password);
            return mysql.query("INSERT INTO users (name, username, password) VALUES (?, ?, ?)", [ displayName, username, passwordHash ]);
        },
        checkLogin: function(username, password) {
            var query = mysql.query("SELECT id, name, password, lastLogin FROM users WHERE username = ?", [ username ]);
            if(query.length == 1) {
                var userData = query[0];
                if(this.confirmHashed(password, userData.password)) {
                    return {
                        id: userData.id,
                        name: userData.name,
                        firstLogin: userData.lastLogin == null
                    };
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
    };
};

module.exports = auth;