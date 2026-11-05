import {Database} from "better-sqlite3";


interface PasswordManagerMetadata {
    userMetadata: Record<string, any>;
    internalMetadata: Record<string, any>;
    tags: string[];
}

interface PasswordManagerHost {
    uuid: string;
    type: string | null;
}

interface SshKeyConfiguration extends PasswordManagerMetadata {
    identifier: number;
    name: string;
    key: string;
    passphrase?: string;
}

type SshKeyCreateParameters = Omit<SshKeyConfiguration, 'identifier'>;
type SshKeyReference = number | Pick<SshKeyConfiguration, 'identifier'> | SshKeyCreateParameters | null;

interface PasswordManagerCredential extends PasswordManagerMetadata {
    identifier: number;
    username?: string | null;
    password?: string | null;
    sshKey?: SshKeyReference;
}

type PasswordManagerCredentialCreateParameters = Omit<PasswordManagerCredential, 'identifier'>;
type PasswordManagerCredentialUpdateParameters = Required<Omit<PasswordManagerCredential, 'identifier'>>;
type PasswordManagerCredentialDetail = PasswordManagerCredential & { hosts: PasswordManagerHost[] }

type CredentialsListingEntry = Omit<PasswordManagerCredential, 'sshKey' | 'password'> & { sshKeyId: number | null, sshKeyName: string | null };


declare interface SshKey {
    identifier: number;
    key: string;
    passphrase: string;
}

declare interface Credential {
    identifier: number;
    username: string;
    password?: string;
    sshKey?: Partial<SshKey> | number;
    resources?: { [key: string]: string | null };
}

export declare class PasswordManager {
    private readonly database: Database;

    constructor(elementoHome: string);

    // @ts-expect-error ES target 2022+
    static #getKey(dbKeyFile: string): Buffer;

    public clearUserData(user: string, organisation?: string): void;

    /**
     * Register a credential in the DB for a user/org.
     *
     * @param user UUID
     * @param organisation UUID
     * @param credential Credentials to store
     *
     * @returns Credential Identifier
     */
    public createCredential(
        user: string,
        organisation: string,
        credential: Omit<Credential, 'identifier' | 'resources'>
    ): number;

    public getUserCredentials(user: string, organisation: string): Credential[];
    public getUserCredential(user: string, organisation: string, credentialIdentifier: number): Credential;

    public updateCredentials(
        user: string,
        organisation: string,
        credentialIdentifier: number,
        data: Partial<Omit<Credential, 'identifier' | 'resources'>>
    ): void;

    public deleteCredential(user: string, organisation: string, credentialIdentifier: number): void;

    public addResourceForCredential(
        user: string,
        organisation: string,
        credentialIdentifier: number,
        resourceUuid: string,
        resourceType?: string
    ): void;

    public getResourceCredentials(
        user: string,
        organisation: string,
        resourceUuid: string,
        resourceType?: string
    ): Omit<Credential, 'resources'>[];

    public removeResourceForCredential(
        user: string,
        organisation: string,
        credentialIdentifier: number,
        resourceUuid: string
    ): void;

    public createSshKey(user: string, organisation: string, sshKey: SshKeyCreateParameters): number;
    public getUserSshKeys(user: string, organisation: string): SshKeyConfiguration[];
    public getSshKey(user: string, organisation: string, keyId: number): Omit<SshKeyConfiguration, 'passphrase'> | null;
    public updateSshKey(user: string, organisation: string, keyIdentifier: number, data: SshKeyCreateParameters): number;
    public deleteSshKey(user: string, organisation: string, keyIdentifier: number): void;

    public close(): void;
}

