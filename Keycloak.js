var KeycloakAdminClient = require("@keycloak/keycloak-admin-client").default
const merge = require('deepmerge')

// There will be soon a other project to manage this list in a gui and us it as feed

const GlobalRooms = [
    "!hgmugBOGJQvzcTLbIw:iot-schweiz.ch", // IOT Space
    "!uJnSWScWWKuoAIdYfw:iot-schweiz.ch", // Server Maintenance
    "!iCvfBACVysaSdWgUsZ:iot-schweiz.ch", // World Chat
]


const Group2Room = {
    "/IOT-CoM": [
        "!ZrIbodrffEXAjfnXFQ:iot-schweiz.ch", // CoM Space
        "!sQCemRDsABfbgHIZZH:iot-schweiz.ch", // Common
    ],
    "/Sections/DE": [
        "!DoRqzpVqkdUAkbhcGb:iot-schweiz.ch", // German
        "!poBhKNBKGHNUAJLZYm:iot-schweiz.ch", // DE Space
        "!EgRbSiYUtaLjmGSRjG:iot-schweiz.ch", // Allgemein
        ...GlobalRooms
    ],
    "/Sections/CH": [
        "!DoRqzpVqkdUAkbhcGb:iot-schweiz.ch", // German
        "!QvpbWUFcNDfDbQOmTe:iot-schweiz.ch", // CH Space
        "!bDTYvUIQlWgFZbqjaj:iot-schweiz.ch", // Allgemein
        ...GlobalRooms
    ],
    "/Sections/AT": [
        "!DoRqzpVqkdUAkbhcGb:iot-schweiz.ch", // German
        "!rGIgQcgZhohzHvmFsq:iot-schweiz.ch", // AT Space
        "!CRJFdgdctQLlrIoYHh:iot-schweiz.ch", // Allgemein
        ...GlobalRooms
    ],
    "/Sections/BIS": [
        "!PVaMPzVHKvlcnbbHTE:iot-schweiz.ch", // BIS Space
        "!CUTmeAgCqYIHlRsoxN:iot-schweiz.ch", // Default
        ...GlobalRooms
    ],
    "/Sections/NAS": [
        "!UahcqBCrLtaThZjqGQ:iot-schweiz.ch", // NAS Space
        "!nJtxPlJROmQYQSIGCM:iot-schweiz.ch", // Default room
        ...GlobalRooms
    ],
    "/Sections/SAS": [
        "!SYJVIVOHKluzDeJJOw:iot-schweiz.ch", // SAS Space
        "!VVWfbjzusZvJhceljm:iot-schweiz.ch", // Default
        ...GlobalRooms
    ],
    "/Sections/Gallia": [
        "!ThdFAdKukPLATDtxyi:iot-schweiz.ch", // Gallia Space
        "!MZhftUApKFUBdrMBfO:iot-schweiz.ch", // Default room
        ...GlobalRooms
    ],
    "/IOT-Supper-Admin": [

    ],
}



class Keycloak {
    constructor() {
        this.kcAdminClient;
        this.groups = {};
        this.user_groups;
        this.adminRoleName = "Matrix Admin"
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

    getAdmins() {
        return this.kcAdminClient.roles.findUsersWithRole({
            name: this.adminRoleName,
        });
    }
    async getServerGroupIds() {
        return this.kcAdminClient.groups.find()
            .then(async groups => {
                return this._find_group_ids(groups, [])
            })
    }

    async _find_group_ids(groups, group_ids) {
        groups.forEach(async group => {
            group_ids.push([group.id, group.path]);
            this._find_group_ids(group.subGroups, group_ids);
        });
        return group_ids;
    }

    // get all keycloak group lists and merge it to one list with all groups
    async getUpdatedUserRooms(whitelist) {
        whitelist = whitelist.reduce((a, v) => ({ ...a, [v.name]: v }), {});
        let groupIds = await this.getServerGroupIds();

        let updatedUserRooms = {};

        // Wait untill we have all group api requests and return it as one list
        return Promise.all(
            groupIds.map(async (groupId) => {

                let groupData = await this.getGroupMembers(groupId[0]);

                let UpdatedUserGroupeRooms = await this.generateUpdatedUserRooms(groupId[0], groupId[1], groupData, whitelist);
                updatedUserRooms = merge(updatedUserRooms, UpdatedUserGroupeRooms);
            })
        )
            .then(async () => {

                // Add  admin flag when user is in admin role.
                // Keycloak api will ignore users that have not the role self,
                // but are in a group with role mapping...
                // https://github.com/keycloak/keycloak/pull/6326

                // So when the user is in a group with matrix admin role mapping, 
                // we will set the admin flag already on the group loop

                let admins = await this.getAdmins();
                admins = admins.reduce((a, v) => ({ ...a, [v.id]: v }), {});

                for (const [userId] of Object.entries(updatedUserRooms)) {
                    // when user has the  admin role we have to set it here.
                    // Users in a groupe with admin mapping, have the flag already
                    if (userId in admins || updatedUserRooms[userId]["admin"] === true) {
                        updatedUserRooms[userId]["admin"] = true;
                    } else {
                        updatedUserRooms[userId]["admin"] = false;
                    }
                }

                return updatedUserRooms
            })
    }

    // Transform all keycloak group data to a User groupe list
    // eg: {user1: {"room1": true,"room2": true}}
    async generateUpdatedUserRooms(groupId, groupPath, users, whitelist) {

        let updatedUserRooms = {};
        let isAdminGroup = await this.isAdminGroup(groupId);

        users.forEach(user => {
            // Groupmember is enabled and in Matrix
            if (user.enabled === true && this.getMatrixUserId(user.id) in whitelist) {
                updatedUserRooms[user.id] = { "rooms": {} };

                // set admin flag when user is in a kcgroupe that is mapped to the matrix admin role
                if (isAdminGroup === true) {
                    updatedUserRooms[user.id]["admin"] = true;
                }

                // We have some allowed Rooms for this Group
                if (groupPath in Group2Room) {
                    Group2Room[groupPath].forEach(room => {
                        updatedUserRooms[user.id]["rooms"][room] = true;
                    })
                }
            }
        })

        return updatedUserRooms;
    }

    async isAdminGroup(groupId) {
        let listRealmRoleMappings = await this.kcAdminClient.groups.listRealmRoleMappings({
            id: groupId,
        });

        let isAdmin = false;

        listRealmRoleMappings.forEach(role => {
            if (role.name === this.adminRoleName) {
                isAdmin = true
            }
        })

        return isAdmin;
    }

    getMatrixUserId(kcUserId) {
        return '@' + kcUserId + ':iot-schweiz.ch';
    }
}

module.exports = { Keycloak }