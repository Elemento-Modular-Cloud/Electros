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
    sshKey?: SshKey;
    resources?: { [key: string]: string | null };
}

declare class PasswordManager {
    private readonly database: Database;

    constructor(elementoHome: string);

    private static getKey(dbKeyFile: string): string;

    public clearUserData(user: string, organisation?: string): void;

    public getResourceCredentials(
        user: string,
        organisation: string,
        resourceUuid: string,
        resourceType?: string
    ): Omit<Credential, 'resources'>[];

    public createResourceCredential(
        user: string,
        organisation: string,
        resourceUuid: string,
        credential: Omit<Credential, 'identifier' | 'resources'>,
        resourceType?: string,
    ): void;

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
}

