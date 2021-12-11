const axios = require('axios');
const dotenv = require('dotenv');
const Storage = require('node-storage');
const { diff } = require("deep-object-diff");
const { Keycloak } = require('./Keycloak');
const { Matrix } = require('./Matrix');

var store = new Storage('./data/migrationStore');
dotenv.config();

var migratedUsers = store.get("migratedUsers");
const supremeKaosId = "48548912-4990-4fc5-bdf5-cb7d6f28ec75";
const keycloak = new Keycloak();
const matrix = new Matrix();

var cron = require('node-cron');

cron.schedule('*/5 * * * * *', () => {
    main();
});




async function main() {

    // Calculate a current list of matrix users and his rooms
    // and diff it with the migration list
    let userChanges = await getKeaycloakUserChanges();

    // Add a user to some Matrix rooms
    // logout users with no more Matrix access
    // manage admin status in Matrix
    if (userChanges) {
        migrateUserChanges(userChanges);
    }
}


// Add or remove a user from Matrix Rooms
async function migrateUserChanges(userChanges) {
    for (const [userId, changes] of Object.entries(userChanges)) {
        // Ignore changes from this bot. 
        if (userId === supremeKaosId) { continue; }

        // We do not delete matrix users, but when a user is deactivated 
        // or have no access to any matrix rooms, we will logout him
        if (migratedUsers[userId] === undefined || Object.keys(migratedUsers[userId].rooms).length === 0) {
            console.log("remove user from matrix", userId);
            // matrix.userLogout(getMatrixUserId(userId));
        } else {

            // Check room changes
            if (changes.rooms) {
                for (const [roomId, status] of Object.entries(changes.rooms)) {
                    if (status === undefined) {
                        // we will ignore when ONE room will be removed
                        // So when the autojoin rooms changes, you will be invited to new one but can keep on your rooms
                    } else {
                        // add user to matrix room
                        console.log("Invite user: ", userId, " to Matrix room: ", roomId);
                        matrix.joinToRooms(keycloak.getMatrixUserId(userId), roomId)
                    }
                }
            }

            // Enabe/disable admin rights in Matrix
            matrix.setAdmin(keycloak.getMatrixUserId(userId), changes.admin);
        }
    }
}


// calculat needet keycloak user changes
async function getKeaycloakUserChanges() {
    return keycloak.login()
        .then(async () => {

            let matrixUsers = await matrix.getUserList();

            if (!matrixUsers) {
                console.log("Matrix feed konnte nicht abgerufen werden, abbrechen!");
                return false;
            }
            // Calculate a current list of matrix users and his rooms
            let updatedUserRooms = await keycloak.getUpdatedUserRooms(matrixUsers.users);
            if (!updatedUserRooms) {
                console.log("keine keycloak daten erhalten, abbrechen!");
                return false;
            }

            let userChanges = diff(migratedUsers, updatedUserRooms);

            migratedUsers = updatedUserRooms;
            store.put("migratedUsers", migratedUsers);

            return userChanges;
        });
}
