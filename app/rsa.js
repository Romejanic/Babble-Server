const crypto = require("crypto");
const keypair = require("keypair");

const rsa = {
    generateKeypair: function() {
        this.rsaKeys = keypair();
        return this;
    },
    encrypt: function(content, publicKey, disablePadding = false, isString = true) {
        var buf = isString ? new Buffer(content) : content;
        // return crypto.publicEncrypt({
        //     key: publicKey,
        //     padding: disablePadding ? crypto.constants.RSA_NO_PADDING : crypto.constants.RSA_PKCS1_OAEP_PADDING   
        // }, buf);
        return crypto.publicEncrypt(publicKey, buf);
    },
    decrypt: function(buffer, privateKey, disablePadding = false, asString = true) {
        // var decrypt = crypto.publicDecrypt({
        //     key: privateKey,
        //     padding: disablePadding ? crypto.constants.RSA_NO_PADDING : crypto.constants.RSA_PKCS1_OAEP_PADDING   
        // }, buffer);
        var decrypt = crypto.privateDecrypt(privateKey, buffer);
        return asString ? decrypt.toString() : decrypt;
    },
    encryptVerified: function(content, publicKey) {
        var publicEncrypt = this.encrypt(content, this.rsaKeys.private);
        return this.encrypt(publicEncrypt, publicKey, false, false);
    },
    decryptVerified: function(buffer, publicKey) {
        var privateDecrypt = this.decrypt(buffer, this.rsaKeys.private, false, false);
        return this.logAndReturn(this.decrypt(privateDecrypt, publicKey));
    },

    logAndReturn: function(data) {
        console.log("data =", data);
        return data;
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