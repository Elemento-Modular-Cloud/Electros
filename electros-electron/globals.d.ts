
export {};

declare global {
    namespace globals {
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
    }
}

