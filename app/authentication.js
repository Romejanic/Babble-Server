/**
 * Authentication.js by Jack Davenport.
 * Responsible for logging users in and generating password hashes.
 */

const crypto = require("crypto");

// create a function (so we can pass parameters to it)
const auth = function(mysql) {
    return {
        // generates a password salt and generates a hash from the password
        hashPassword: function(password) {
            // generate 24 cryptographically-secure random bytes
            var salt = crypto.randomBytes(17).toString("base64").slice(0, 24);
            // generate a salted hash of the password and append the salt to the string
            return salt + crypto.createHmac("sha256", salt).update(salt+password).digest("base64");
        },
        // checks the given password matches the given password hash
        confirmHashed: function(password, hash) {
            // extract the hash and salt from the string
            var salt = hash.substring(0, 24);
            var pwHash = hash.substring(24);
            // hash the given password with the same salt
            password = crypto.createHmac("sha256", salt).update(salt+password).digest("base64");
            // compares the two hashes
            return password === pwHash;
        },

        // registers a new user in the database
        registerUser: function(displayName, username, password) {
            // hash the password
            var passwordHash = this.hashPassword(password);
            // query the database and add the user
            return mysql.query("INSERT INTO users (name, username, password) VALUES (?, ?, ?)", [ displayName, username, passwordHash ]);
        },
        // checks the login details of the user, with the given username and password
        checkLogin: function(username, password) {
            // query the database and get the user details from the username
            var query = mysql.query("SELECT id, name, password, lastLogin FROM users WHERE username = ?", [ username ]);
            if(query.length == 1) {
                // get the user from the query
                var userData = query[0];
                // check the password is correct
                if(this.confirmHashed(password, userData.password)) {
                    // password is correct, return the user's details
                    return {
                        id: userData.id,
                        name: userData.name,
                        firstLogin: userData.lastLogin == null
                    };
                } else {
                    // password is incorrect, return false
                    return false;
                }
            } else {
                // the user was not found, return false
                return false;
            }
        }
    };
};

// export the function to the module
module.exports = auth;