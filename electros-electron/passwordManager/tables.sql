CREATE TABLE IF NOT EXISTS userProfiles
(
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    ownerUuid    TEXT NOT NULL,
    organisation TEXT NOT NULL,

    UNIQUE (ownerUuid, organisation) -- DO UPDATE SET on Conflict
);


CREATE INDEX IF NOT EXISTS idx_userProfiles_owner ON userProfiles (ownerUuid);


CREATE TABLE IF NOT EXISTS sshKeys
(
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT    NOT NULL DEFAULT 'SSH Key',
    keyEncrypted        TEXT    NOT NULL,
    passphraseEncrypted TEXT             DEFAULT NULL,

    createdAt           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lastReadAt          TEXT             DEFAULT NULL, -- todo)) update in dbms on read

    userMetadata        TEXT             DEFAULT '{}',
    internalMetadata    TEXT             DEFAULT '{}',
    tags                TEXT             DEFAULT '',

    owner               INTEGER NOT NULL,

    UNIQUE (id, owner),

    FOREIGN KEY (owner)
        REFERENCES userProfiles (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_sshKeys_owner ON sshKeys (owner);


CREATE TABLE IF NOT EXISTS credentials
(
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    username          TEXT             DEFAULT NULL,
    passwordEncrypted TEXT             DEFAULT NULL,

    sshKey            INTEGER          DEFAULT NULL,
    owner             INTEGER NOT NULL,

    createdAt         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lastReadAt        TEXT             DEFAULT NULL, -- todo)) update in dbms on read

    userMetadata      TEXT             DEFAULT '{}',
    internalMetadata  TEXT             DEFAULT '{}',
    tags              TEXT             DEFAULT '',

    CHECK (username IS NOT NULL OR passwordEncrypted IS NOT NULL or sshKey IS NOT NULL),

    UNIQUE (id, owner),

    FOREIGN KEY (sshKey, owner)                      -- TODO)) Check for double FK with Owner to avoid cross-ownership
        REFERENCES sshKeys (id, owner)
        ON UPDATE CASCADE
        ON DELETE NO ACTION,

    FOREIGN KEY (owner)
        REFERENCES userProfiles (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_credentials_owner ON credentials (owner);
CREATE INDEX IF NOT EXISTS idx_credentials_sshKey ON credentials (sshKey);


CREATE TABLE IF NOT EXISTS hosts
(
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    resourceUuid     TEXT    NOT NULL,
    resourceType     TEXT DEFAULT NULL,
    owner            INTEGER NOT NULL,

    userMetadata     TEXT DEFAULT '{}',
    internalMetadata TEXT DEFAULT '{}',
    tags             TEXT DEFAULT '',

    UNIQUE (owner, resourceUuid),

    FOREIGN KEY (owner)
        REFERENCES userProfiles (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);


CREATE INDEX IF NOT EXISTS idx_hosts_owner ON hosts (owner);


CREATE TABLE IF NOT EXISTS hostsCredentials
(
    owner        INTEGER NOT NULL,
    resourceUuid TEXT    NOT NULL,
    credential   INTEGER NOT NULL,

    PRIMARY KEY (owner, resourceUuid, credential),

    FOREIGN KEY (owner, resourceUuid)
        REFERENCES hosts (owner, resourceUuid)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    FOREIGN KEY (credential, owner)
        REFERENCES credentials (id, owner)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hostsCredentials_credential ON hostsCredentials (credential);

