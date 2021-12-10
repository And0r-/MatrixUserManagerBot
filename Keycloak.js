var KeycloakAdminClient = require("@keycloak/keycloak-admin-client").default
const merge = require('deepmerge')

// There will be soon a other project to manage this list in a gui and us it as feed
const Group2Room = {
    "/IOT-CoM": [
        "room8",
    ],
    "/IOT-Member/DE": [
        "room1",
        "room52",
        "room64",
        "room7755",
    ],
    "/IOT-Member/CH": [
        "room2",
        "room92",
        "room63433",
        "room7",
    ],
    "/IOT-Member/AT": [
        "room3",
        "room5332",
        "room61",
        "room789",
    ],
    "/IOT-Supper-Admin": [
        "room42",
        "room522222",
        "room6",
        "room78",
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

    async getServerGroupIds() {
        return this.kcAdminClient.groups.find()
            .then(async groups => {
                return this._find_group_ids(groups, [])
            })
    }

    async _find_group_ids(groups, group_ids) {
        groups.forEach(async group => {
            group_ids.push([group.id, group.path]);
            // console.log(group)
            this._find_group_ids(group.subGroups, group_ids);
        });
        return group_ids;
    }

    // get all keycloak group lists and merge it to one list with all groups
    async getUpdatedUserRooms(whitelist={}) {
        whitelist = whitelist.reduce((a, v) => ({ ...a, [v.name]: v }), {});
        let groupIds = await this.getServerGroupIds();

        let updatedUserRooms = {};
        // console.log("whitelist",whitelist);

        // 
        return Promise.all(
            groupIds.map(async (groupId) => {
                let groupData = await this.getGroupMembers(groupId[0]);

                // console.log(groupData);

                let UpdatedUserGroupeRooms = this.generateUpdatedUserRooms(groupId[1], groupData, whitelist);
                updatedUserRooms = merge(updatedUserRooms, UpdatedUserGroupeRooms);
            })
        )
            .then(() => { return updatedUserRooms })
    }

    // Transform all keycloak group data to a User groupe list
    // eg: {user1: {"room1": true,"room2": true}}
    generateUpdatedUserRooms(group, users, whitelist) {
        
        let updatedUserRooms = {};
        if (group === "/IOT-Supper-Admin") {
            console.log("admins: ",users);
        }

        users.forEach(user => {
            
            // Groupmember is enabled and in Matrix
            if (user.enabled === true && '@'+user.id+':iot-schweiz.ch' in whitelist) {
                updatedUserRooms[user.id] = {"rooms":{}};

                // We have some allowed Rooms for this Group
                if (group in Group2Room) {
                    Group2Room[group].forEach(room => {
                        updatedUserRooms[user.id]["rooms"][room] = true;
                    })
                }
                if (group === "/IOT-Supper-Admin") {
                    updatedUserRooms[user.id]["admin"] = true;
                }
            }
        })

        return updatedUserRooms;
    }
}

module.exports = { Keycloak }