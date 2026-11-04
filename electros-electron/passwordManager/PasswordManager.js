const fs = require('fs');
const { safeStorage } = require('electron');
const crypto = require('node:crypto');
const {join} = require("path");


class DatabaseUnavailableException extends Error { name = "DatabaseUnavailableException"; }


class PasswordManager {
    static #getKey(dbKeyFile) {
        if (!fs.existsSync(dbKeyFile)) {
            const randomData = crypto.randomBytes(32).toString('hex');
            const ciphered = safeStorage.encryptString(randomData);
            fs.writeFileSync(dbKeyFile, ciphered, { flush: true });
            return Buffer.from(randomData);
        } else {
            const binCiphered = fs.readFileSync(dbKeyFile);
            return Buffer.from(safeStorage.decryptString(binCiphered));
        }
    }

    constructor(elementoHome) {
        if (!safeStorage.isEncryptionAvailable()) {
            console.error('[ERROR] Keychain is unavailable; Password Manager unavailable');
            this.database = null;
        } else {
            if (!fs.existsSync(join(elementoHome, 'cdb'))) { fs.mkdirSync(join(elementoHome, 'cdb'), { recursive: true }); }
            const targetDbFile = join(elementoHome, 'cdb', `credentials-store`);

            if (!fs.existsSync(targetDbFile)) { console.info("[INFO] Database file missing, creating."); }

            this.database = require("better-sqlite3-multiple-ciphers")(targetDbFile);
            this.database.pragma('cipher_memory_security = ON');
            this.database.key(PasswordManager.#getKey(`${targetDbFile}.key`));
            this.database.pragma('journal_mode = WAL');
            this.database.pragma('foreign_keys = on');

            this.#clearDbTables(); // FIXME)) !!!!!!!!!! TO BE REMOVED !!!!!!!!! LITERALLY DROPS THE WHOLE DB !!!!!!!!!!
            this.#initDbTables();
        }
    }

    #initDbTables() {
        const tablesSqlFile = join(__dirname, 'tables.sql');
        const contents = fs.readFileSync(tablesSqlFile, 'utf8').toString();
        this.database.exec(contents);
    }

    #clearDbTables() {
        this.database.exec(`
DROP TABLE IF EXISTS hostsCredentials;
DROP TABLE IF EXISTS hosts;
DROP TABLE IF EXISTS sshKeys;
DROP TABLE IF EXISTS credentials;
DROP TABLE IF EXISTS userProfiles;
        `);
    }

    /** @returns Promise<number> */
    #registerUser(userUuid, orgUuid) {
        if (typeof userUuid !== 'string' || typeof orgUuid !== 'string') { throw new TypeError("Parameters userUuid and orgUuid must be strings"); }
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        return new Promise((resolve) => {
            const insert = this.database.prepare(`INSERT INTO userProfiles VALUES (NULL, ?, ?);`);
            this.database.transaction(() => {
                const info = insert.run(userUuid, orgUuid)
                resolve(info.lastInsertRowid);
            })();
        });
    }

    createCredential(
        user, organisation, { username, password, sshKey }
    ) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        const stmt = this.database.prepare(`INSERT INTO credentials VALUES (null, ?, ?, ?, ?);`);

        return new Promise((resolve) => {
            this.#getOwnerId(user, organisation).then((ownerId) => {
                this.#getSshKeyId(ownerId, sshKey).then((keyId) => {
                    const info = stmt.run(username, password, keyId, ownerId)
                    resolve(info.lastInsertRowid);
                });
            });
        });
    }

    /** @returns Promise<number> */
    #createSshKey(ownerId, { key, passphrase }) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        return new Promise((resolve) => {
            const insert = this.database.prepare(`INSERT INTO sshKeys VALUES (NULL, ?, ?, ?);`);
            this.database.transaction(() => {
                const info = insert.run(key, passphrase, ownerId);
                resolve(info.lastInsertRowid);
            })();
        });
    }

    /** @returns Promise<number> */
    #getSshKeyId(ownerId, sshKey) {
        return new Promise((resolve) => {
            if (typeof sshKey !== "number" && Object.keys(sshKey) === ['identifier']) {
                resolve(sshKey.identifier);
            } else if (typeof sshKey !== 'number') {
                this.#createSshKey(ownerId, sshKey).then(resolve);
            } else {
                resolve(sshKey);
            }
            resolve(null);
        });
    }

    /** @returns Promise<number> */
    #getOwnerId(user, org) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        return new Promise((resolve) => {
            const userId = this.database
                .prepare(`SELECT id
                          FROM main.userProfiles
                          WHERE ownerUuid = ?
                            AND organisation = ?;`)
                .get(user, org);

            if (typeof userId === "number") { resolve(userId); }
            this.#registerUser(user, org).then(resolve);
        });
    }

    dumpUsers() {
        const q = this.database.prepare(`SELECT * FROM userProfiles;`).all();
        console.dir(q);

        const q2 = this.database.prepare(`SELECT * FROM credentials;`).all();
        console.dir(q2);

        const q3 = this.database.prepare(`SELECT * FROM sshKeys;`).all();
        console.dir(q3);
    }
}

exports.PasswordManager = PasswordManager;
exports.DatabaseUnavailableException = DatabaseUnavailableException;
