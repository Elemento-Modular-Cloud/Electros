const fs = require('fs');
const { safeStorage } = require('electron');
const crypto = require('node:crypto');
const {join} = require("path");


class PasswordManager {
    static getKey(dbKeyFile) {
        if (!fs.existsSync(dbKeyFile)) {
            const randomData = crypto.randomBytes(32).toString('hex');
            const ciphered = safeStorage.encryptString(randomData);
            fs.writeFileSync(dbKeyFile, ciphered, { flush: true });
            return randomData;
        } else {
            const binCiphered = fs.readFileSync(dbKeyFile, 'binary');
            return safeStorage.decryptString(binCiphered);
        }
    }

    constructor(elementoHome) {
        if (!safeStorage.isEncryptionAvailable()) {
            console.error('[ERROR] Keychain is unavailable; Password Manager unavailable');
            this.database = null;
        } else {
            const targetDbFile = join(elementoHome, `credentials-store`);

            if (!fs.existsSync(targetDbFile)) {
                console.info("[INFO] Database file missing, creating.");
            }
            this.database = require("better-sqlite3-multiple-ciphers")(targetDbFile);
            this.database.pragma(`rekey='${PasswordManager.getKey(`${targetDbFile}.key`)}'`);
            this.database.pragma('cipher_memory_security = ON');
            this.database.pragma('journal_mode = WAL');
        }
    }


}

exports.PasswordManager = PasswordManager;
