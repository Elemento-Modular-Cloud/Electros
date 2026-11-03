import {Database} from "better-sqlite3";

declare class PasswordManager {
    private readonly database: Database;

    constructor(elementoHome: string);

    private static getKey(dbKeyFile: string): string;
}

