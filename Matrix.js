const axios = require('axios');

class Matrix {
    constructor() {
    }

    async getUserList() {
        let config = {
            headers: {
                'Authorization': 'Bearer ' + process.env.MATRIX_BOT_TOKEN
            }
        }

        let url = process.env.MATRIX_HOST + '_synapse/admin/v2/users';

        return axios.get(url, config)
            .then(res => {
                return res.data;
            })
            .catch(error => {
                console.log("error..." + error)
                console.log(error.response.data);
            });
    }


    async joinToRooms(userId, matrixRoom) {

        // set axios request config
        let config = {
            headers: {
                'Authorization': 'Bearer ' + process.env.MATRIX_BOT_TOKEN
            }
        }

        let body = { user_id: userId }
        console.log(body);

        let url = process.env.MATRIX_HOST + '_synapse/admin/v1/join/' + matrixRoom;

        console.log("url: ", url);

        await axios.post(url, body, config)
            .then(res => {
                console.log(res.data);
            })
            .catch(error => {
                console.log("error..." + error)
                console.log(error.response.data);
            });
    }

    async joinToRooms(userId, matrixRoom) {

        // set axios request config
        let config = {
            headers: {
                'Authorization': 'Bearer ' + process.env.MATRIX_BOT_TOKEN
            }
        }

        let body = { user_id: userId }
        console.log(body);

        let url = process.env.MATRIX_HOST + '_synapse/admin/v1/join/' + matrixRoom;

        console.log("url: ", url);

        await axios.post(url, body, config)
            .then(res => {
                console.log(res.data);
            })
            .catch(error => {
                console.log("error..." + error)
                console.log(error.response.data);
            });
    }

    async userLogout(userId) {

        // set axios request config
        let config = {
            headers: {
                'Authorization': 'Bearer ' + process.env.MATRIX_BOT_TOKEN,
                'Content-Type': 'application/json'
            }
        }

        let url = process.env.MATRIX_HOST + '_synapse/admin/v2/users/'+userId+'/devices';


        axios.get(url, config)
            .then(res => {
                console.log(res.data);

                res.data.devices.forEach(device => {
                    let deleteDeviceUrl = process.env.MATRIX_HOST + '_synapse/admin/v2/users/'+userId+'/devices/'+device.device_id;
                    axios.delete(deleteDeviceUrl, config)
                    .then(res2 => {
                        console.log(res2.data);        
                    })
                    .catch(error => {
                        console.log("error..." + error)
                        console.log(error.response.data);
                    });
                })

            })
            .catch(error => {
                console.log("error..." + error)
                console.log(error.response.data);
            });
    }


    async setAdmin(userId, isAdmin) {
        console.log(isAdmin);

        // set axios request config
        let config = {
            headers: {
                'Authorization': 'Bearer ' + process.env.MATRIX_BOT_TOKEN,
                'Content-Type': 'application/json'
            }
        }

        console.log("config: ", config);

        let body = { admin: isAdmin }

        let url = process.env.MATRIX_HOST + '_synapse/admin/v2/users/' + userId;

        console.log("url: ", url);

        await axios.put(url, body, config)
            .then(res => {
                console.log(res.data);
            })
            .catch(error => {
                console.log("error..." + error)
                console.log(error.response.data);
            });

    }
}

module.exports = { Matrix }