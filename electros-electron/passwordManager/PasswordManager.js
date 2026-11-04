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

    createCredential(
        user, organisation, { username, password, sshKey }
    ) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        const stmt = this.database.prepare(`INSERT INTO credentials VALUES (null, ?, ?, ?, ?);`);

        const ownerId = this.#getOwnerId(user, organisation);
        const keyId = this.#getOrCreateSshKeyId(ownerId, sshKey);
        const info = stmt.run(username, password, keyId, ownerId)
        return info.lastInsertRowid;
    }

    getUserCredentials(user, organisation) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }
        const ownerId = this.#getOwnerId(user, organisation);

        const stmt = this.database.prepare(`
SELECT
    credentials.id,
    credentials.username,
    credentials.password,
    sshKeys.key,
    COUNT(hC.resourceUuid) as hostCredentials
FROM credentials
LEFT OUTER JOIN sshKeys
    ON sshKeys.id = credentials.sshKey
LEFT OUTER JOIN hostsCredentials hC
    on credentials.id = hC.credential
WHERE credentials.owner = ?
GROUP BY
    credentials.id,
    credentials.username,
    credentials.password,
    sshKeys.key;
        `);

        const results = stmt.all(ownerId);
        console.dir(results);
    }

    /** @returns number */
    #createSshKey(ownerId, { key, passphrase }) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        const insert = this.database.prepare(`INSERT INTO sshKeys VALUES (NULL, ?, ?, ?);`);
        const info = insert.run(key, passphrase, ownerId);
        return info.lastInsertRowid;
    }

    /** @returns { number | null } */
    #getOrCreateSshKeyId(ownerId, sshKey) {
        if (typeof sshKey !== "number" && Object.keys(sshKey) === ['identifier']) {
            return sshKey.identifier;
        } else if (typeof sshKey !== 'number') {
            return this.#createSshKey(ownerId, sshKey);
        } else if (typeof sshKey === 'number') {
            return sshKey;
        }
        return null;
    }

    /** @returns number */
    #getOwnerId(user, org) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        const userId = this.database
            .prepare(`SELECT id
                      FROM main.userProfiles
                      WHERE ownerUuid = ?
                        AND organisation = ?;`)
            .get(user, org);

        if (typeof userId === "number") { return userId; }
        return this.#registerUser(user, org);
    }

    /** @returns number */
    #registerUser(userUuid, orgUuid) {
        if (typeof userUuid !== 'string' || typeof orgUuid !== 'string') { throw new TypeError("Parameters userUuid and orgUuid must be strings"); }
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        const insert = this.database.prepare(`INSERT INTO userProfiles VALUES (NULL, ?, ?);`);
        const info = insert.run(userUuid, orgUuid)
        return info.lastInsertRowid;
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
