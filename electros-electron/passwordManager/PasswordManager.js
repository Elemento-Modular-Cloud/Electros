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

    /**
     * @param {string} user
     * @param {string} organisation
     * @param {PasswordManagerCredentialCreateParameters} param2
     * @return {number | bigint}
     */
    createCredential(
        user,
        organisation, {
            username = null,
            password = null,
            sshKey = null,
            userMetadata = {},
            internalMetadata = {},
            tags = []
        }
    ) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        const stmt = this.database.prepare(`
INSERT INTO credentials (username, passwordEncrypted, sshKey, owner, userMetadata, internalMetadata, tags)
VALUES (?, ?, ?, ?, ?, ?, ?);
        `);

        const ownerId = this.#getOrCreateOwnerId(user, organisation);
        const keyId = this.#getOrCreateSshKeyId(ownerId, sshKey);
        const info = stmt.run(
            username ?? null,
            password ?? null,
            keyId,
            ownerId,
            JSON.stringify(userMetadata),
            JSON.stringify(internalMetadata),
            JSON.stringify(tags)
        )
        return info.lastInsertRowid;
    }

    /**
     * @param {string} user
     * @param {string} organisation
     * @returns { CredentialsListingEntry[] }
     */
    getUserCredentials(user, organisation) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }
        const ownerId = this.#getOrCreateOwnerId(user, organisation);

        const stmt = this.database.prepare(`
SELECT credentials.id               AS credentialId,
       credentials.username         AS username,
       credentials.userMetadata     AS userMetadata,
       credentials.internalMetadata AS internalMetadata,
       credentials.tags             AS credentialTags,
       sshKeys.id                   AS sshKeyId,
       sshKeys.name                 AS sshKeyName,
       COUNT(hC.resourceUuid)       as hostCredentials
FROM credentials
         LEFT OUTER JOIN sshKeys
                         ON sshKeys.id = credentials.sshKey
         LEFT OUTER JOIN hostsCredentials hC
                         on credentials.id = hC.credential
WHERE credentials.owner = ?
GROUP BY credentials.id,
         credentials.username,
         credentials.passwordEncrypted,
         sshKeys.name;
        `);

        return stmt.all(ownerId).map(r => {
            return {
                identifier: r.credentialId,
                username: r.username,
                userMetadata: JSON.parse(r.userMetadata),
                internalMetadata: JSON.parse(r.internalMetadata),
                tags: JSON.parse(r.credentialTags),
                sshKeyId: r.sshKeyId,
                sshKeyName: r.sshKeyName,
            };
        });
    }

    /**
     * @param {string} user
     * @param {string} organisation
     * @param {number} credentialIdentifier
     * @returns {PasswordManagerCredentialDetail | null}
     */
    getUserCredential(user, organisation, credentialIdentifier) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }
        const ownerId = this.#getOrCreateOwnerId(user, organisation);

        const stmt = this.database.prepare(`
SELECT credentials.id AS credentialId,
       credentials.username AS username,
       credentials.passwordEncrypted AS password,
       credentials.userMetadata AS userMetadata,
       credentials.internalMetadata AS internalMetadata,
       credentials.tags AS tags,
       sshKeys.id AS sshKeyId,
       sshKeys.name AS sshKeyName,
       h.resourceUuid AS resourceUuid,
       h.resourceType AS resourceType
FROM credentials
         LEFT OUTER JOIN sshKeys
                         ON sshKeys.id = credentials.sshKey
         LEFT OUTER JOIN hostsCredentials hC
                         ON credentials.id = hC.credential
         LEFT OUTER JOIN hosts h
                         ON hC.resourceUuid = h.resourceUuid
WHERE credentials.owner = ? AND credentials.id = ?
        `);

        const results = stmt.all(ownerId, credentialIdentifier);

        if (results.length === 0) { return null; }

        const hosts = results.map(r => { return { uuid: r.resourceUuid, type: r.resourceType }; });
        return {
            identifier: results[0].credentialId,
            username: results[0].username,
            password: results[0].password,
            sshKey: { identifier: results[0].sshKeyId, name: results[0].sshKeyName },
            hosts: hosts,
            tags: JSON.parse(results[0].tags),
            internalMetadata: JSON.parse(results[0].internalMetadata),
            userMetadata: JSON.parse(results[0].userMetadata)
        };
    }

    /**
     * @param {string} user
     * @param {string} organisation
     * @param {number} credentialIdentifier
     * @param {PasswordManagerCredentialUpdateParameters} param3
     */
    updateCredentials(
        user,
        organisation,
        credentialIdentifier, {
            username,
            password,
            sshKey,
            userMetadata = null,
            internalMetadata = null,
            tags = null
        }
    ) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        const ownerId = this.#getOrCreateOwnerId(user, organisation);
        const newKeyId = this.#getOrCreateSshKeyId(ownerId, sshKey);

        const stmt = this.database.prepare(`
UPDATE credentials
SET tags = COALESCE(@tags, tags),
    userMetadata = COALESCE(@userMetadata, userMetadata),
    internalMetadata = COALESCE(@internalMetadata, internalMetadata),
    username = @username,
    passwordEncrypted = @password,
    sshKey = @sshKeyId,
    updatedAt = CURRENT_TIMESTAMP
WHERE id = @credId
  AND owner = @ownerId;`);

        stmt.run({
            username: username ?? null,
            password: password ?? null,
            sshKeyId: newKeyId ?? null,
            internalMetadata: internalMetadata === null ? null : JSON.stringify(internalMetadata),
            userMetadata: userMetadata === null ? null : JSON.stringify(userMetadata),
            tags: tags === null ? null : JSON.stringify(tags),
            credId: credentialIdentifier,
            ownerId: ownerId,
        });
    }

    /**
     * @param {string} user
     * @param {string} organisation
     * @param {number} credentialIdentifier
     * @param {PasswordManagerCredentialUpdateParameters} param3
     */
    deleteCredential(user, organisation, credentialIdentifier) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }
        const ownerId = this.#getOrCreateOwnerId(user, organisation);
        const statement = this.database.prepare(`DELETE FROM credentials WHERE credentials.owner = ? AND credentials.id = ?;`);
        statement.run(ownerId, credentialIdentifier);
    }

    /**
     *
     * @param {string} user
     * @param {string} organisation
     * @param {number} credentialIdentifier
     * @param {string} resourceUuid
     * @param {string | null} resourceType
     */
    addResourceForCredential( user, organisation, credentialIdentifier, resourceUuid, resourceType = null ) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }
        const ownerId = this.#getOrCreateOwnerId(user, organisation);

        // todo))
    }


    /**
     * @param {string} user
     * @param {string} organisation
     * @param {SshKeyCreateParameters} data
     * @returns { number | bigint }
     */
    createSshKey(user, organisation, sshKey) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }
        const ownerId = this.#getOrCreateOwnerId(user, organisation);
        return this.#createSshKey(ownerId, sshKey);
    }

    /**
     * @param {string} user
     * @param {string} organisation
     * @returns {SshKeyConfiguration[] | null}
     */
    getUserSshKeys(user, organisation) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }
        const ownerId = this.#getOrCreateOwnerId(user, organisation);

        const results = this.database.prepare(`
SELECT sshKeys.id,
       sshKeys.id AS id,
       sshKeys.name AS name,
       sshKeys.keyEncrypted AS key,
--        sshKeys.passphraseEncrypted AS passphrase,
       sshKeys.userMetadata AS meta,
       sshKeys.internalMetadata AS internalMeta,
       sshKeys.tags AS tags
FROM sshKeys
WHERE owner = ?;
        `).all(ownerId);

        return results.map(result => {
            return {
                identifier: results.id,
                key: results.key,
                // passphrase: results.passphrase,
                name: results.name,
                userMetadata: JSON.parse(results.meta),
                internalMetadata: JSON.parse(results.internalMeta),
                tags: JSON.parse(results.tags)
            }
        });
    }

    /**
     * @param {string} user
     * @param {string} organisation
     * @param {number} keyId
     * @returns {SshKeyConfiguration | null}
     */
    getSshKey(user, organisation, keyId) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }
        const ownerId = this.#getOrCreateOwnerId(user, organisation);

        const result = this.database.prepare(`
SELECT sshKeys.id,
       sshKeys.id AS id,
       sshKeys.name AS name,
       sshKeys.keyEncrypted AS key,
       sshKeys.passphraseEncrypted AS passphrase,
       sshKeys.userMetadata AS meta,
       sshKeys.internalMetadata AS internalMeta,
       sshKeys.tags AS tags
FROM sshKeys
WHERE owner = ?
  AND id = ?;
        `).get(ownerId, keyId);
        if (!result) { return null; }

        return {
            identifier: result.id,
            key: result.key,
            passphrase: result.passphrase,
            name: result.name,
            userMetadata: JSON.parse(result.meta),
            internalMetadata: JSON.parse(result.internalMeta),
            tags: JSON.parse(result.tags)
        };
    }

    /**
     * @param {string} user
     * @param {string} organisation
     * @param {number} keyId
     * @param {SshKeyCreateParameters} data
     */
    updateSshKey(
        user,
        organisation,
        keyId, {
            name = null,
            key = null,
            passphrase,
            userMetadata = null,
            internalMetadata = null,
            tags = null
        }
    ) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }
        const ownerId = this.#getOrCreateOwnerId(user, organisation);

        const stmt = this.database.prepare(`
UPDATE sshKeys
SET name = COALESCE(@name, name),
    keyEncrypted = COALESCE(@key, keyEncrypted),
    passphraseEncrypted = @passphrase,
    userMetadata = COALESCE(@userMetadata, userMetadata),
    internalMetadata = COALESCE(@internalMetadata, internalMetadata),
    tags = COALESCE(@tags, tags),
    updatedAt = CURRENT_TIMESTAMP
WHERE id = @keyId
  AND owner = @ownerId;`);

        stmt.run({
            name: name ?? null,
            key: key ?? null,
            passphrase: passphrase ?? null,
            userMetadata: userMetadata === null ? null : JSON.stringify(userMetadata),
            internalMetadata: internalMetadata === null ? null : JSON.stringify(internalMetadata),
            tags: tags === null ? null : JSON.stringify(tags),
            keyId: keyId,
            ownerId: ownerId,
        });
    }

    /**
     * @param {string} user
     * @param {string} organisation
     * @param {number} keyId
     */
    deleteSshKey(user, organisation, keyId) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }
        const ownerId = this.#getOrCreateOwnerId(user, organisation);

        const statement = this.database.prepare(` DELETE FROM sshKeys WHERE owner = ? AND id = ?; `);
        statement.run(ownerId, keyId);
    }

    /**
     * @param {number} ownerId
     * @param {SshKeyCreateParameters} param1
     * @return {number | bigint}
     */
    #createSshKey(ownerId, { key, passphrase, name }) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        const insert = this.database.prepare(`
INSERT INTO sshKeys (name, keyEncrypted, passphraseEncrypted, owner)
VALUES (?, ?, ?, ?);
        `);
        const info = insert.run(name ?? null, key, passphrase ?? null, ownerId);
        return info.lastInsertRowid;
    }

    /**
     *
     * @param {number} ownerId
     * @param {SshKeyReference} sshKey
     * @return {number|bigint|null}
     */
    #getOrCreateSshKeyId(ownerId, sshKey) {
        if (sshKey === null || sshKey === undefined) { return null; }
        if (typeof sshKey !== "number" && Object.keys(sshKey).includes('identifier')) {
            return sshKey.identifier;
        } else if (typeof sshKey !== 'number') {
            return this.#createSshKey(ownerId, sshKey);
        } else if (typeof sshKey === 'number') {
            return sshKey;
        }
        return null;
    }

    /**
     * @param {string} user
     * @param {string} org
     * @return {number|bigint}
     */
    #getOrCreateOwnerId(user, org) {
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        const userId = this.database
            .prepare(`SELECT id
                      FROM main.userProfiles
                      WHERE userUuid = ?
                        AND organisation = ?;`)
            .get(user, org);

        if (userId && userId.id) { return userId.id; }
        return this.#registerUser(user, org);
    }

    /**
     * @param {string} userUuid
     * @param {string} orgUuid
     * @return {number|bigint}
     */
    #registerUser(userUuid, orgUuid) {
        if (typeof userUuid !== 'string' || typeof orgUuid !== 'string') { throw new TypeError("Parameters userUuid and orgUuid must be strings"); }
        if (this.database === null) { throw new DatabaseUnavailableException(); }

        const insert = this.database.prepare(`INSERT INTO userProfiles (userUuid, organisation) VALUES (?, ?);`);
        const info = insert.run(userUuid, orgUuid)
        return info.lastInsertRowid;
    }

    #initDbTables() {
        const tablesSqlFile = join(__dirname, 'tables.sql');
        const contents = fs.readFileSync(tablesSqlFile, 'utf8').toString();
        this.database.exec(contents);
    }

    #clearDbTables() {
        try {
            this.database.exec(`
                DROP TABLE IF EXISTS userProfiles;
                DROP TABLE IF EXISTS sshKeys;
                DROP TABLE IF EXISTS hosts;
                DROP TABLE IF EXISTS credentials;
                DROP TABLE IF EXISTS hostsCredentials;
            `);
        } catch (error) {
            console.error(error);
        }
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
