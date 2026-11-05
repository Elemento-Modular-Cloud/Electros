import {Join} from "sharp";

export {};

declare global {
    namespace globals {
        interface PasswordManagerMetadata {
            userMetadata: Record<string, any>;
            internalMetadata: Record<string, any>;
            tags: string[];
        }

        interface SshKeyConfiguration extends PasswordManagerMetadata {
            identifier: number;
            name: string;
            key: string;
            passphrase?: string;
        }

        type SshKeyCreateParameters = Omit<SshKeyConfiguration, 'identifier'>;
        type SshKeyReference = number | Pick<SshKeyConfiguration, 'identifier'> | SshKeyCreateParameters;

        interface PasswordManagerCredential extends PasswordManagerMetadata {
            identifier: number;
            username?: string;
            password?: string;
            sshKey?: SshKeyReference;
        }

        type PasswordManagerCredentialCreateParameters = Omit<PasswordManagerCredential, 'identifier'>;

        type CredentialsListingEntry = Omit<PasswordManagerCredential, 'sshKey' | 'password'> & { sshKeyId: number | null, sshKeyName: string | null };
    }
}

