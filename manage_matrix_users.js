const axios = require('axios');
const dotenv = require('dotenv');
const Storage = require('node-storage');
const { diff } = require("deep-object-diff");
const { Keycloak } = require('./Keycloak');
const { Matrix } = require('./Matrix');

var store = new Storage('temp');
dotenv.config();

var migratedUsers = store.get("migratedUsers");
var StoredMatrixUsers = store.get("matrix_users");
const keycloak = new Keycloak();
const matrix = new Matrix();

main();


async function main() {
    // On first time the script is running we dont know anything
    // So we have to initialize a lot and try to join all matrix users to his rooms
    if (migratedUsers === undefined) {
        await _initMigratedUsers();
    }

    // Check is there a new user and add it to migration
    matrix_user_check()
        .then(async () => {
            // calculate a current list of matrix users and his rooms
            // and diff it with the migration list
            let userChanges = await getKeaycloakUserChanges();

            // Add or remove a user from Matrix Rooms
            migrateUserChanges(userChanges);
        })
}


// Add or remove a user from Matrix Rooms
async function migrateUserChanges(userChanges) {
    for (const [userId, changes] of Object.entries(userChanges)) {
        console.log("UserID: ", userId);
        console.log("MatrixUserId: ",getMatrixUserId(userId))
        console.log("Changes: ", changes);
        

        // User has no access to any room we will only logout him
        // He will not be able to login again
        // Or we have a bug in this cron
        if (migratedUsers[userId] === undefined) {
            console.log("remove user from matrix",userId);
            // let StoredMatrixUsers = store.get("matrix_users");
            // console.log("matrix users before delete: ",StoredMatrixUsers);
            // delete StoredMatrixUsers.users[userId];
            // console.log("matrix users after delete: ",StoredMatrixUsers);
            // store.put("matrix_users", StoredMatrixUsers);
            // matrix.userLogout(getMatrixUserId(userId));
        } else {

            // Check room changes
            if(changes.rooms){
                for (const [roomId,status] of Object.entries(changes.rooms)) {
                    if(status === undefined) {
                        // we will ignore when ONE room will be removed
                        // So when the autojoin rooms changes, you will be invited to new one but can keep on your rooms
                    } else {
                        // add user to matrix room
                        console.log("Invite user: ",userId, " to Matrix room: ",roomId);
                        matrix.joinToRooms(getMatrixUserId(userId), roomId)
                    }
                }
            }
            if (changes.admin === true) {
                console.log("user is now admin");
                matrix.setAdmin(getMatrixUserId(userId), true);
            } else if ("admin" in changes && changes.admin === undefined) {
                console.log("user is no more admin");
                matrix.setAdmin(getMatrixUserId(userId), false);
            }
            // }
        }
    }
}


// Extract keycloak UserId from Matrix UserId
// And add it to the migrationList
function addUsertoMigration(username) {
    if (username.match("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")) {
        migratedUsers[username.substr(1, 36)] = {}
    }
}

function getMatrixUserId(kcUserId) {
    return '@'+kcUserId+':iot-schweiz.ch';
}


// calculat needet keycloak user changes
async function getKeaycloakUserChanges() {
    return keycloak.login()
        .then(async () => {

            // Calculate a current list of matrix users and his rooms
            let updatedUserRooms = await keycloak.getUpdatedUserRooms(StoredMatrixUsers.users);

            console.log("updated list: ",updatedUserRooms);
            let userChanges = diff(migratedUsers, updatedUserRooms);

            migratedUsers = updatedUserRooms;
            store.put("migratedUsers", migratedUsers);

            return userChanges;
        });
}


// add new Matrix users to migrationList
// all users on this list will be checked and invite to some rooms
async function matrix_user_check() {
    let matrixUsers = await matrix.getUserList();

    // Convert user array to object
    StoredMatrixUsersObj = StoredMatrixUsers.users.reduce((a, v) => ({ ...a, [v.name]: v }), {});

    matrixUsers.users.forEach(async new_user => {
        // check is there a new user
        if (StoredMatrixUsersObj[new_user.name] === undefined) {
            console.log("new matrix user found :D");
            console.log(new_user.name);
            // A new user found add it to migrationList
            addUsertoMigration(new_user.name);
        }
    });

    store.put("matrix_users", matrixUsers);
    StoredMatrixUsers = matrixUsers;
     
}


// One time script to import all matrix users on first run
async function _initMigratedUsers() {
    migratedUsers = {};
    StoredMatrixUsers = await matrix.getUserList();
    console.log(StoredMatrixUsers.users);
    StoredMatrixUsers.users.forEach(async user => {
        addUsertoMigration(user.name);
    })
    console.log(migratedUsers);
    store.put("migratedUsers", migratedUsers);
    store.put("matrix_users", StoredMatrixUsers);
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