/**
 * Encrypt.js by Jack Davenport.
 * Used by the Babble application for performing a key exchange and
 * encrypting data with AES.
 */

const crypto = require("crypto");

// some constant variables
const aesCipher   = "aes-256-cbc";
const primeLength = 1024;

const encrypt = function() {
    return {
        keyExchange: undefined,
        keyExchangeKey: undefined,
        aesIv: undefined,
        aesKey: undefined,

        onAesKeyGenerated: undefined,

        // creates a key exchange and generates our public key
        createKeyExchange: function(prime, generator) {
            if(!prime && !generator) {
                // creates a new prime number and generator
                this.keyExchange = crypto.createDiffieHellman(primeLength);
                this.keyExchange.isInitial = true;
            } else {
                // creates from the supplied prime number and generator
                this.keyExchange = crypto.createDiffieHellman(prime, "base64", generator, "base64");
                this.keyExchange.isInitial = false;
            }
            // generate the keys
            this.keyExchangeKey = this.keyExchange.generateKeys("base64");
        },
        // calculate the secret (AES key) which is common between the two parties
        calculateSecret: function(otherKey, aesIv) {
            // calculate the key from the other person's public key
            this.aesKey = this.keyExchange.computeSecret(Buffer.from(otherKey, "base64"));
            // hash the key to make it work with AES
            this.aesKey = crypto.createHash("sha256").update(this.aesKey).digest();
            if(!aesIv) {
                // generate a new, random IV
                this.aesIv = crypto.randomBytes(16);
            } else {
                // use the supplied IV
                this.aesIv = Buffer.from(aesIv, "base64");
            }
            this.aesKey = Buffer.from(this.aesKey);
            if(this.onAesKeyGenerated) {
                // callback the onAesKeyGenerated() function
                this.onAesKeyGenerated();
            }
        },
        // send the initial key exchange packet to the socket, beginning the exchange
        sendKeyExchangePacket: function(socket) {
            if(!this.keyExchange.isInitial) {
                // don't send if we don't have the prime number
                return;
            }
            // send a socket message with the prime and generator
            socket.write(JSON.stringify({
                id: "key_exchange_prime",
                payload: {
                    prime: this.keyExchange.getPrime("base64"),
                    generator: this.keyExchange.getGenerator("base64")
                }
            }));
        },
        // recieves and parses a key exchange message
        handleKeyExchangePacket: function(data, socket) {
            try {
                // convert data from JSON to object
                var str = data.toString();
                var obj = JSON.parse(str);
                if(!obj.id || !obj.payload) {
                    throw "Invalid packet format";
                }

                if(obj.id == "key_exchange_prime") {
                    // create a key exchange with the prime and generator
                    this.createKeyExchange(obj.payload.prime, obj.payload.generator);
                    // send back our public key
                    socket.write(JSON.stringify({
                        id: "key_exchange",
                        payload: {
                            key: this.keyExchangeKey
                        }
                    }));
                } else if(obj.id == "key_exchange") {
                    // calculate our secret number and store the IV
                    this.calculateSecret(obj.payload.key, obj.payload.iv);
                    if(this.keyExchange.isInitial) {
                        // if we are the first person, send back our public key and the iv
                        socket.write(JSON.stringify({
                            id: "key_exchange",
                            payload: {
                                key: this.keyExchangeKey,
                                iv: this.aesIv.toString("base64")
                            }
                        }));
                    }
                } else {
                    // the id of the packet is invalid, throw an error
                    throw "Not a key exchange packet";
                }
            } catch(e) {
                // we failed to handle the packet (most likely caused by a JSON parse error)
                console.error("Error handling data packet!");
                console.error(e);
                socket.write(JSON.stringify({
                    id: "key_exchange_error",
                    payload: e
                }));
            }
        },

        // encrypt the supplied data with the AES cipher
        encrypt: function(data) {
            // create a cipher
            var cipher = crypto.createCipheriv(aesCipher, this.aesKey, this.aesIv);
            // encrypt the data and return it
            var encrypted = cipher.update(data, "utf8", "base64");
            encrypted += cipher.final("base64");
            return encrypted;
        },
        // decrypt the data with the AES cipher
        decrypt: function(encrypted) {
            // create a decipher
            var decipher = crypto.createDecipheriv(aesCipher, this.aesKey, this.aesIv);
            // decrypt the data and return it
            var decrypted = decipher.update(encrypted, "base64", "utf8");
            decrypted += decipher.final("utf8");
            return decrypted;
        }
    };
};

// export the function to a module
module.exports = encrypt;