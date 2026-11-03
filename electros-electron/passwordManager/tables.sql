

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
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE sshKeys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    passphrase TEXT DEFAULT NULL,

    owner TEXT NOT NULL,

    FOREIGN KEY (owner)
        REFERENCES userProfiles(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE hosts (
    resourceUuid TEXT NOT NULL PRIMARY KEY,
    resourceType TEXT DEFAULT NULL,
    owner TEXT NOT NULL,

    FOREIGN KEY (owner)
        REFERENCES userProfiles(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE hostsCredentials
(
    resourceUuid TEXT    NOT NULL,
    credential   INTEGER NOT NULL,

    PRIMARY KEY (resourceUuid, credential),

    FOREIGN KEY (resourceUuid)
        REFERENCES hosts (resourceUuid)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    FOREIGN KEY (credential)
        REFERENCES credentials (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

