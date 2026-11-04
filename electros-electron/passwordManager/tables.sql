

CREATE TABLE IF NOT EXISTS userProfiles(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ownerUuid TEXT NOT NULL,
    organisation TEXT NOT NULL,

    UNIQUE (ownerUuid, organisation) ON CONFLICT IGNORE
);

CREATE TABLE IF NOT EXISTS credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT DEFAULT NULL,
    password TEXT DEFAULT NULL,

    sshKey INTEGER DEFAULT NULL,
    owner INTEGER NOT NULL,

    FOREIGN KEY (sshKey)
        REFERENCES sshKeys(id)
        ON UPDATE CASCADE
        ON DELETE SET DEFAULT,

    FOREIGN KEY (owner)
        REFERENCES userProfiles(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sshKeys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    passphrase TEXT DEFAULT NULL,

    owner INTEGER NOT NULL,

    FOREIGN KEY (owner)
        REFERENCES userProfiles(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hosts (
    resourceUuid TEXT NOT NULL PRIMARY KEY,
    resourceType TEXT DEFAULT NULL,
    owner INTEGER NOT NULL,

    FOREIGN KEY (owner)
        REFERENCES userProfiles(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hostsCredentials (
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

