const crypto = require("crypto");
const keypair = require("keypair");

const rsa = {
    generateKeypair: function() {
        this.rsaKeys = keypair();
        return this;
    },
    encrypt: function(content, publicKey) {
        if(!publicKey) {
            publicKey = this.rsaKeys.private;
        }
        var buf = new Buffer(content);
        return crypto.publicEncrypt(publicKey, buf);
    },
    decrypt: function(buffer, privateKey) {
        if(!privateKey) {
            privateKey = this.rsaKeys.public;
        }
        var decrypt = crypto.publicDecrypt(privateKey, buffer);
        return decrypt.toString();
    },
    encryptVerified: function(content, publicKey) {
        var publicEncrypt = this.encrypt(content);
        return this.encrypt(publicEncrypt, publicKey);
    },
    decryptVerified: function(buffer, privateKey) {
        var privateDecrypt = crypto.publicDecrypt(privateKey, buffer);
        return this.decrypt(privateDecrypt);
    },

    sendKeyExchangePacket: function(socket) {
        var packet = {
            id: "rsa_public_key",
            payload: this.rsaKeys.public
        };
        socket.write(JSON.stringify(packet));
    }
};

module.exports = rsa;