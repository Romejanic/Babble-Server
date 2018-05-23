const crypto = require("crypto");

const aesCipher   = "aes-128-cbc";
const primeLength = 1024;

const encrypt = function() {
    return {
        keyExchange: undefined,
        keyExchangeKey: undefined,
        aesIv: undefined,
        aesKey: undefined,

        createKeyExchange: function(prime, generator) {
            if(!prime && !generator) {
                this.keyExchange = crypto.createDiffieHellman(primeLength);
                this.keyExchange.isInitial = true;
            } else {
                this.keyExchange = crypto.createDiffieHellman(prime, "base64", generator, "base64");
                this.keyExchange.isInitial = false;
            }
            this.keyExchangeKey = this.keyExchange.generateKeys("base64");
        },
        calculateSecret: function(otherKey, aesIv) {
            this.aesKey = this.keyExchange.computeSecret(Buffer.from(otherKey, "base64")).slice(0, 16);
            if(!aesIv) {
                this.aesIv = crypto.randomBytes(16);
            } else {
                this.aesIv = Buffer.from(aesIv, "base64");
            }
            this.aesKey = Buffer.from(this.aesKey);
        },
        sendKeyExchangePacket: function(socket) {
            if(!this.keyExchange.isInitial) {
                return;
            }
            socket.write(JSON.stringify({
                id: "key_exchange_prime",
                payload: {
                    prime: this.keyExchange.getPrime("base64"),
                    generator: this.keyExchange.getGenerator("base64")
                }
            }));
        },
        handleKeyExchangePacket: function(data, socket) {
            try {
                var str = data.toString();
                var obj = JSON.parse(str);
                if(!obj.id || !obj.payload) {
                    throw "Invalid packet format";
                }
                console.log(obj);

                if(obj.id == "key_exchange_prime") {
                    this.createKeyExchange(obj.payload.prime, obj.payload.generator);
                    socket.write(JSON.stringify({
                        id: "key_exchange",
                        payload: {
                            key: this.keyExchangeKey
                        }
                    }));
                } else if(obj.id == "key_exchange") {
                    this.calculateSecret(obj.payload.key, obj.payload.iv);
                    if(this.keyExchange.isInitial) {
                        socket.write(JSON.stringify({
                            id: "key_exchange",
                            payload: {
                                key: this.keyExchangeKey,
                                iv: this.aesIv.toString("base64")
                            }
                        }));
                    }
                } else {
                    throw "Not a key exchange packet";
                }
            } catch(e) {
                console.error("Error handling data packet!");
                console.error(e);
                socket.write(JSON.stringify({
                    id: "key_exchange_error",
                    payload: e
                }));
            }
        },

        encrypt: function(data) {
            var cipher = crypto.createCipheriv(aesCipher, this.aesKey, this.aesIv);
            var encrypted = cipher.update(data, "utf8", "base64");
            encrypted += cipher.final("base64");
            return encrypted;
        },
        decrypt: function(encrypted) {
            var decipher = crypto.createDecipheriv(aesCipher, this.aesKey, this.aesIv);
            var decrypted = decipher.update(encrypted, "base64", "utf8");
            decrypted += decipher.final("utf8");
            return decrypted;
        }
    };
};
module.exports = encrypt;