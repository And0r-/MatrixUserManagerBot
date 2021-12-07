var KeycloakAdminClient = require("@keycloak/keycloak-admin-client").default

class Keycloak {
    constructor() {
        this.kcAdminClient;
        this.groups = {};
        this.user_groups;
    }

    async login() {
        this.kcAdminClient = new KeycloakAdminClient({
            baseUrl: process.env.KEYCLOAK_BASE_URL,
        });

        await this.kcAdminClient.auth({
            username: process.env.KEYCLOAK_BOT_NAME,
            password: process.env.KEYCLOAK_BOT_PASSWORD,
            grantType: 'password',
            clientId: 'admin-cli',
            // totp: '123456', // optional Time-based One-time Password if OTP is required in authentication flow
        });

        this.kcAdminClient.setConfig({
            realmName: 'IOT',
        });
    }

    getUserList() {
        return this.kcAdminClient.users.find();
    }

    getGroupMembers(groupId) {
        return this.kcAdminClient.groups.listMembers({ id: groupId });
    }

    async getServerGroupIds() {
        return this.kcAdminClient.groups.find()
            .then(async groups => {
                return this._find_group_ids(groups, [])
            })
    }

    async _find_group_ids(groups, group_ids) {
        groups.forEach(async group => {
            group_ids.push([group.id,group.path]);
            // console.log(group)
            this._find_group_ids(group.subGroups, group_ids);
        });
        return group_ids;
    }
}

module.exports = { Keycloak }