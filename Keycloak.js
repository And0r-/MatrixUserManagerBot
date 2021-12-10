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
    "/IOT-Member/DE": [
        "!DoRqzpVqkdUAkbhcGb:iot-schweiz.ch", // German
        "!poBhKNBKGHNUAJLZYm:iot-schweiz.ch", // DE Space
        "!EgRbSiYUtaLjmGSRjG:iot-schweiz.ch", // Allgemein
        ...GlobalRooms
    ],
    "/IOT-Member/CH": [
        "!DoRqzpVqkdUAkbhcGb:iot-schweiz.ch", // German
        "!QvpbWUFcNDfDbQOmTe:iot-schweiz.ch", // CH Space
        "!bDTYvUIQlWgFZbqjaj:iot-schweiz.ch", // Allgemein
        ...GlobalRooms
    ],
    "/IOT-Member/AT": [
        "!DoRqzpVqkdUAkbhcGb:iot-schweiz.ch", // German
        "!rGIgQcgZhohzHvmFsq:iot-schweiz.ch", // AT Space
        "!CRJFdgdctQLlrIoYHh:iot-schweiz.ch", // Allgemein
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
            name: 'Matrix Admin',
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

                let UpdatedUserGroupeRooms = this.generateUpdatedUserRooms(groupId[1], groupData, whitelist);
                updatedUserRooms = merge(updatedUserRooms, UpdatedUserGroupeRooms);
            })
        )
            .then(async () => {

                // Add  admin informations
                // @TODO: the role api will ignore users that in a group with admin role mapping
                let admins = await this.getAdmins();
                console.log("admins feed:",admins)
                admins = admins.reduce((a, v) => ({ ...a, [v.id]: v }), {});

                for (const [userId] of Object.entries(updatedUserRooms)) {
                    if (userId in admins) {
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
    generateUpdatedUserRooms(group, users, whitelist) {

        let updatedUserRooms = {};

        users.forEach(user => {
            // Groupmember is enabled and in Matrix
            if (user.enabled === true && this.getMatrixUserId(user.id) in whitelist) {
                updatedUserRooms[user.id] = { "rooms": {} };

                // We have some allowed Rooms for this Group
                if (group in Group2Room) {
                    Group2Room[group].forEach(room => {
                        updatedUserRooms[user.id]["rooms"][room] = true;
                    })
                }

            }
        })

        return updatedUserRooms;
    }

    getMatrixUserId(kcUserId) {
        return '@' + kcUserId + ':iot-schweiz.ch';
    }
}

module.exports = { Keycloak }