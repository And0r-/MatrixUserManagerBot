const axios = require('axios');
const dotenv = require('dotenv');
const Storage = require('node-storage');
const { diff } = require("deep-object-diff");
const merge = require('deepmerge')
const { Keycloak } = require('./Keycloak');
const { Matrix } = require('./Matrix');

var store = new Storage('temp');
dotenv.config();

var migratedUsers = store.get("migratedUsers");
const keycloak = new Keycloak();
const matrix = new Matrix();


const Group2Room = {
    "/IOT-CoM": [
        "room8",
    ],
    "/IOT-Member/DE": [
        "room1",
        "room5",
        "room64",
        "room775",
    ],
    "/IOT-Member/CH": [
        "room2",
        "room54",
        "room63",
        "room7",
    ],
    "/IOT-Member/AT": [
        "room3",
        "room53",
        "room6",
        "room789",
    ],
    "/IOT-Supper-Admin": [
        "room4",
        "room5",
        "room6",
        "room78",
    ],
}

main();


function main() {
    if (migratedUsers === undefined) {
        initMigratedUsers();
    }

    matrix_user_check()
        .then(() => {
            keycloak_user_check();
        })
}


async function initMigratedUsers() {
    migratedUsers = {};
    let matrix_users = await matrix.getUserList();
    console.log(matrix_users.users);
    matrix_users.users.forEach(async user => {
        addUsertoMigration(user.name);
    })
    console.log(migratedUsers);
    store.put("migratedUsers", migratedUsers);
    store.put("matrix_users", matrix_users);
}


function addUsertoMigration(username) {
    if (username.match("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) {
        migratedUsers[username.substr(1, 36)] = {}
    }
}


async function keycloak_user_check() {
    keycloak.login()
        .then(async () => {

            let updatedUserRooms = await getupdatedUserRooms();

            migrateUserChanges(diff(migratedUsers, updatedUserRooms));

            migratedUsers = updatedUserRooms;
            store.put("migratedUsers", migratedUsers);
        });
}


// get all keycloak group lists and merge it to one list with all groups
async function getupdatedUserRooms() {
    let groupIds = await keycloak.getServerGroupIds();

    let updatedUserRooms = {};

    return Promise.all(
        groupIds.map(async (groupId) => {
            let groupData = await keycloak.getGroupMembers(groupId[0]);

            let UpdatedUserGroupeRooms = generateUpdatedUserRooms(groupId[1], groupData);
            updatedUserRooms = merge(updatedUserRooms, UpdatedUserGroupeRooms);
        })
    )
        .then(() => { return updatedUserRooms })
}


async function migrateUserChanges(userChanges) {
    for (const userChange of Object.entries(userChanges)) {
        console.log(userChange);
    }

}

// Transform all keycloak group data to a User groupe list
// user1: {
//     "room1": true,
//     "room2": true,
// },
function generateUpdatedUserRooms(group, users) {
    let updatedUserRooms = {};

    users.forEach(user => {
        // Groupmember is enabled and in Matrix
        if (user.enabled === true && user.id in migratedUsers) {
            // console.log("matrix user:" + user.firstName + " is in group: " + group);
            updatedUserRooms[user.id] = {};
            if (group in Group2Room) {
                Group2Room[group].forEach(room => {
                    // console.log(room);
                    updatedUserRooms[user.id][room] = true;
                    // console.log(updatedUserRooms);
                })
            }
        }
    })

    return updatedUserRooms;
}


// add new Matrix users to migrationList
// all users on this list will be checked and invite to some rooms
async function matrix_user_check() {
    let new_data = await matrix.getUserList();
    let old_data = store.get("matrix_users");

    // convert user array to object
    old_data = old_data.users.reduce((a, v) => ({ ...a, [v.name]: v }), {});
    new_data.users.forEach(async new_user => {
        // check is there a new user
        if (old_data[new_user.name] === undefined) {
            console.log("new matrix user found :D");
            console.log(new_user.name)
            addUsertoMigration(new_user.name);
        }
    });

    store.put("matrix_users", new_data);
}




// notes:
// ---------------------------------------------------------------------------------------


// one feed per group with users
let group1 = [
    {
        id: 'user1',
        enabled: true
    },
    "user2",
    "user3",
];

let group2 = [
    "user1",
    "user2",
    "user3",
];

let group3 = [
    "user1",
    {
        id: '321e3f76-9f7b-4fe8-83a1-838947810c70',// user2
        createdTimestamp: 1634816737158,
        username: 'ahabegger@gmail.com',
        enabled: true,// important
        totp: false,
        emailVerified: true,
        firstName: 'Nemo',
        email: 'ahabegger@gmail.com',
        disableableCredentialTypes: [],
        requiredActions: [],
        notBefore: 0
    },
];

// transform: loop over all groups and add rooms to kcmember[user.id] when user is enabled

// config feed groups 2 rooms mapping
let groupMaping = {
    group1: [
        "room1",
        "room2",
    ],
    group2: [
        "room1",
        "room3",
    ],
    '/IOT-Member/CH': [
        "room1",
        "room4",
    ],
}


// current migration state:
let migrate = {
    user1: {
        "room1": true,
        "room2": true,
        "room3": true,
        "room4": true,
    },
    user2: {
        "room1": true,
        "room2": true,
        "room3": true,
        "room4": true,
    },
    user3: {
        "room1": true,
        "room2": true,
        "room3": true,
        "room4": true,
    }
}


let migrate2 = {
    user1: {
        "room1": true,
        "room3": true,
        "room2": true,
        "room4": true,
    },
    user2: {
        "room1": true,
        "room3": true,
        "room4": true,
    },
    user4: {
        "room1": true,
        "room2": true,
        "room3": true,
        "room4": true,
    }
}


// console.log(diff(migrate, migrate2));


// {
//     user3: undefined,
//     user2: { room2: undefined },
//     user4: { room1: true, room2: true, room3: true, room4: true }
//   }



// async function get_map

// class Bot {
//     constructor() {
//         this._botLogin;
//     }


//     async _botLogin() {

//         // set request url
//         let url = 'https://keycloak.iot-schweiz.ch/auth/realms/master/protocol/openid-connect/token';

//         // set axios request config
//         let config = {
//             headers: {
//                 'Content-Type': 'application/x-www-form-urlencoded'
//             }
//         }

//         const params = new URLSearchParams()
//         params.append('username', 'registerbot')
//         params.append('password', 'test')
//         params.append('grant_type', 'password')
//         params.append('client_id', 'admin-cli')


//         // fier first create request 
//         await axios.post(url, params, config)
//             .then(res => {
//                 console.log(res.data);
//                 this.access_token = res.data.access_token
//             })
//             .catch(error => {
//                 console.log("error..." + error)
//                 console.log(error.response.data);
//             });
//     }
// }

// let bot = new Bot();

// console.log(bot.access_token)

// dotenv.config();
// const fs = require('fs')
// const path = require('path')
// var app_config = require('./app_config');
// var matrix_config = require('./data/matrix_config');

// const mailBodyHtml = fs.readFileSync(path.resolve(__dirname, 'mail/welcome.html'), 'utf8')

// class MatrixPromoter {
//     constructor(req) {
//         this.keycloakUserRequest = req;
//         this.access_token;
//         this.admin = false;
//         this.matrixRooms = [];
//         this.matrixUserId;
//     }

//     async promoteUser() {

//         let keycloakUserRequest = this.keycloakUserRequest;
//         let matrixRooms = [];


//         // verify Matrix token and get user id to invite in Channels
//         this.matrixUserId = await axios.post(app_config.matrixHost + '_matrix/client/r0/login', { type: "m.login.token", token: keycloakUserRequest.params.MToken })
//             .then(function (response) {

//                 return response.data.user_id;
//             });

//         this.admin = keycloakUserRequest.kauth.grant.access_token.content.role.includes("Matrix Admin");

//         this._setAdmin();

//         console.log("matrix Id: ", this.matrixUserId);
//         console.log("groups: ", keycloakUserRequest.kauth.grant.access_token.content.groups);

//         console.log("admin: ", keycloakUserRequest.kauth.grant.access_token.content.role.includes("Matrix Admin"));



//         for (const group of keycloakUserRequest.kauth.grant.access_token.content.groups) {
//             console.log(matrix_config[group]);
//             this._joinToRooms(matrix_config[group])
//         }


//     }

//     async _joinToRooms(matrixRooms) {
//         // await sleep(5000);

//         // set axios request config
//         let config = {
//             headers: {
//                 'Authorization': 'Bearer ' + process.env.MATRIX_BOT_TOKEN
//             }
//         }
//         let body = { user_id: this.matrixUserId }
//         console.log(body);

//         matrixRooms.forEach(async function (room) {

//             let url = app_config.matrixHost + '_synapse/admin/v1/join/' + room;

//             console.log("url: ", url);

//             await axios.post(url, body, config)
//                 .then(res => {
//                     console.log(res.data);
//                 })
//                 .catch(error => {
//                     console.log("error..." + error)
//                     console.log(error.response.data);
//                 }); 
//         })
//     }

//     async _setAdmin() {

//         // set axios request config
//         let config = {
//             headers: {
//                 'Authorization': 'Bearer ' + process.env.MATRIX_BOT_TOKEN,
//                 'Content-Type': 'application/json'
//             }
//         }

//         console.log("config: ",config);

//         let body = { admin: this.admin }

//         let url = app_config.matrixHost + '_synapse/admin/v2/users/' + this.matrixUserId;

//         console.log("url: ",url);

//         await axios.put(url, body, config)
//             .then(res => {
//                 console.log(res.data);
//             })
//             .catch(error => {
//                 console.log("error..." + error)
//                 console.log(error.response.data);
//             });

//     }

// }


// function sleep(ms) {
//     return new Promise((resolve) => {
//         setTimeout(resolve, ms);
//     });
// }

// module.exports = { MatrixPromoter }