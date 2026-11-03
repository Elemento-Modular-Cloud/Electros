

CREATE TABLE userProfiles(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ownerUuid TEXT NOT NULL,
    organisation TEXT NOT NULL
);

CREATE TABLE credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT DEFAULT NULL,
    password TEXT DEFAULT NULL,

    sshKey INTEGER DEFAULT NULL,
    owner TEXT NOT NULL,

    FOREIGN KEY (sshKey, owner)
        REFERENCES sshKeys(id, owner)
        ON UPDATE CASCADE
        ON DELETE SET DEFAULT,

    FOREIGN KEY (owner)
        REFERENCES userProfiles(id)
        ON DELETE CASCADE
);

CREATE TABLE sshKeys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    passphrase TEXT DEFAULT NULL,

    owner TEXT NOT NULL,

    FOREIGN KEY (owner)
        REFERENCES userProfiles(id)
        ON DELETE CASCADE
);

CREATE TABLE hosts (
    resourceUuid TEXT PRIMARY KEY,
    resourceType TEXT,

    credential INTEGER NOT NULL,
    owner TEXT NOT NULL,

    FOREIGN KEY (owner)
        REFERENCES userProfiles(id)
        ON DELETE CASCADE,

    FOREIGN KEY (credential, owner)
        REFERENCES credentials(id, owner)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

