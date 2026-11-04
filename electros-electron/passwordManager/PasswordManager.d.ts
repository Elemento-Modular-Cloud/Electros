import {Database} from "better-sqlite3";


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

    public getResourceCredentials(
        user: string,
        organisation: string,
        resourceUuid: string,
        resourceType?: string
    ): Omit<Credential, 'resources'>[];

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

    public addResourceForCredential(
        user: string,
        organisation: string,
        credentialIdentifier: number,
        resourceUuid: string,
        resourceType?: string
    ): void;

    public removeResourceForCredential(
        user: string,
        organisation: string,
        credentialIdentifier: number,
        resourceUuid: string
    ): void;

    public updateCredentials(
        user: string,
        organisation: string,
        credentialIdentifier: number,
        data: Partial<Omit<Credential, 'identifier' | 'resources'>>
    ): void;

    public close(): void;
}

