const crypto = require("crypto");
const keypair = require("keypair");

const rsa = {
    generateKeypair: function() {
        this.rsaKeys = keypair();
        return this;
    },
    encrypt: function(content, publicKey, disablePadding) {
        if(!publicKey) {
            publicKey = this.rsaKeys.private;
        }
        var buf = new Buffer(content);
        return crypto.publicEncrypt({
            key: publicKey,
            padding: disablePadding ? crypto.constants.RSA_NO_PADDING : crypto.constants.RSA_PKCS1_OAEP_PADDING   
        }, buf);
    },
    decrypt: function(buffer, privateKey, disablePadding) {
        if(!privateKey) {
            privateKey = this.rsaKeys.public;
        }
        var decrypt = crypto.publicDecrypt({
            key: privateKey,
            padding: disablePadding ? crypto.constants.RSA_NO_PADDING : crypto.constants.RSA_PKCS1_OAEP_PADDING   
        }, buffer);
        return decrypt.toString();
    },
    encryptVerified: function(content, publicKey) {
        var publicEncrypt = this.encrypt(content);
        return this.encrypt(publicEncrypt, publicKey, true);
    },
    decryptVerified: function(buffer, privateKey) {
        var privateDecrypt = crypto.publicDecrypt(privateKey, buffer, true);
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